import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  discoverOauthEndpoints,
  exchangeDeviceCode,
  fallbackOauthEndpoints,
  isXaiHttpsUrl,
  refreshOauthToken,
  requestDeviceAuthorization,
} from '../src/oauth.js'
import { GROK_OIDC_CLIENT_ID } from '../src/constants.js'

function jsonResponse(status, body, contentType = 'application/json') {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    status,
    headers: { get: name => (name === 'content-type' ? contentType : null) },
    text: async () => text,
  }
}

test('isXaiHttpsUrl accepts x.ai and rejects anything else', () => {
  assert.equal(isXaiHttpsUrl('https://auth.x.ai/oauth2/token'), true)
  assert.equal(isXaiHttpsUrl('https://accounts.x.ai/oauth2/device?user_code=ABCD-EFGH'), true)
  assert.equal(isXaiHttpsUrl('http://auth.x.ai/oauth2/token'), false)
  assert.equal(isXaiHttpsUrl('https://auth.x.ai.evil.example/oauth2/token'), false)
  assert.equal(isXaiHttpsUrl('https://user:pw@auth.x.ai/oauth2/token'), false)
  assert.equal(isXaiHttpsUrl('not a url'), false)
})

test('discovery falls back without echoing a non-JSON body', async () => {
  const endpoints = await discoverOauthEndpoints('https://auth.x.ai', {
    fetch: async () => jsonResponse(503, '<html>private-upstream-detail</html>', 'text/html'),
  })
  assert.deepEqual(endpoints, fallbackOauthEndpoints('https://auth.x.ai'))
})

test('discovery uses same-origin endpoints and ignores a mismatched issuer', async () => {
  const discovered = await discoverOauthEndpoints('https://auth.x.ai', {
    fetch: async () => jsonResponse(200, {
      issuer: 'https://auth.x.ai',
      device_authorization_endpoint: 'https://auth.x.ai/oauth2/device/code',
      token_endpoint: 'https://auth.x.ai/oauth2/token',
    }),
  })
  assert.equal(discovered.tokenEndpoint, 'https://auth.x.ai/oauth2/token')

  const mismatched = await discoverOauthEndpoints('https://auth.x.ai', {
    fetch: async () => jsonResponse(200, {
      issuer: 'https://auth.x.ai',
      device_authorization_endpoint: 'https://evil.example/device',
      token_endpoint: 'https://evil.example/token',
    }),
  })
  assert.deepEqual(mismatched, fallbackOauthEndpoints('https://auth.x.ai'))
})

test('device-code errors omit the raw body', async () => {
  await assert.rejects(
    () => requestDeviceAuthorization({
      endpoint: 'https://auth.x.ai/oauth2/device/code',
      fetch: async () => jsonResponse(404, '<html>private-upstream-detail</html>', 'text/html'),
    }),
    error => {
      assert.match(error.message, /non-JSON/)
      assert.equal(error.message.includes('private-upstream-detail'), false)
      return true
    },
  )
  await assert.rejects(
    () => requestDeviceAuthorization({
      endpoint: 'http://auth.x.ai/oauth2/device/code',
      fetch: async () => { throw new Error('should not be called') },
    }),
    /non-x\.ai/,
  )
})

test('device authorization returns the user code and keeps the device code on the result only', async () => {
  const seen = []
  const device = await requestDeviceAuthorization({
    endpoint: 'https://auth.x.ai/oauth2/device/code',
    fetch: async (_url, init) => {
      seen.push(init.body)
      return jsonResponse(200, {
        device_code: 'device-secret',
        user_code: '84F2-MKGY',
        verification_uri_complete: 'https://accounts.x.ai/oauth2/device?user_code=84F2-MKGY',
        expires_in: 600,
        interval: 5,
      })
    },
  })
  assert.equal(device.userCode, '84F2-MKGY')
  assert.equal(device.deviceCode, 'device-secret')
  assert.match(seen[0], new RegExp(`client_id=${GROK_OIDC_CLIENT_ID}`))
  assert.match(seen[0], /grok-cli%3Aaccess/)
})

test('token polling treats pending and slow_down as continue, and denial as stop', async () => {
  const pending = await exchangeDeviceCode({
    endpoint: 'https://auth.x.ai/oauth2/token',
    deviceCode: 'device-secret',
    fetch: async () => jsonResponse(400, { error: 'authorization_pending' }),
  })
  assert.equal(pending.kind, 'pending')
  const slowed = await exchangeDeviceCode({
    endpoint: 'https://auth.x.ai/oauth2/token',
    deviceCode: 'device-secret',
    fetch: async () => jsonResponse(400, { error: 'slow_down' }),
  })
  assert.equal(slowed.kind, 'slow_down')
  const denied = await exchangeDeviceCode({
    endpoint: 'https://auth.x.ai/oauth2/token',
    deviceCode: 'device-secret',
    fetch: async () => jsonResponse(400, { error: 'access_denied', error_description: 'The user denied the authorization request' }),
  })
  assert.equal(denied.kind, 'stop')
  assert.match(denied.error, /access_denied/)
  assert.equal(denied.error.includes('device-secret'), false)
})

test('refresh returns new tokens and does not echo the refresh token in errors', async () => {
  const ok = await refreshOauthToken({
    endpoint: 'https://auth.x.ai/oauth2/token',
    clientId: GROK_OIDC_CLIENT_ID,
    refreshToken: 'refresh-secret',
    now: () => Date.parse('2026-09-30T03:00:00Z'),
    fetch: async (_url, init) => {
      assert.match(init.body, /grant_type=refresh_token/)
      assert.equal(init.body.includes('access-secret'), false)
      return jsonResponse(200, { access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600 })
    },
  })
  assert.equal(ok.accessToken, 'access-new')
  assert.equal(ok.refreshToken, 'refresh-new')
  assert.equal(ok.expiresAt, '2026-09-30T04:00:00.000Z')

  await assert.rejects(
    () => refreshOauthToken({
      endpoint: 'https://auth.x.ai/oauth2/token',
      refreshToken: 'refresh-secret',
      fetch: async () => jsonResponse(400, { error: 'invalid_grant', error_description: 'The refresh token was rejected' }),
    }),
    error => {
      assert.match(error.message, /invalid_grant/)
      assert.equal(error.message.includes('refresh-secret'), false)
      return true
    },
  )
})
