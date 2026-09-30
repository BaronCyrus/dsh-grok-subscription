import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readGrokAuthSession } from '../src/auth-file.js'
import { GROK_OIDC_CLIENT_ID, XAI_OAUTH_ISSUER } from '../src/constants.js'
import { createRpcHandler } from '../src/rpc.js'
import { createSessionService, openExternal } from '../src/session.js'

const NOW = Date.parse('2026-09-30T03:00:00Z')
const ENDPOINTS = {
  deviceAuthorizationEndpoint: 'https://auth.x.ai/oauth2/device/code',
  tokenEndpoint: 'https://auth.x.ai/oauth2/token',
}
const LOGIN_URL = 'https://accounts.x.ai/oauth2/device?user_code=84F2-MKGY'

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'grok-login-'))
  return { dir, path: join(dir, 'auth.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

function readOrEmpty(path) {
  try {
    return readGrokAuthSession(path)
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return { session: undefined, reason: 'no-session' }
    throw error
  }
}

function jsonResponse(status, body) {
  const text = JSON.stringify(body)
  return { status, headers: { get: () => null }, text: async () => text }
}

test('openExternal drives the platform opener', async () => {
  const calls = []
  const child = new EventEmitter()
  child.unref = () => {}
  const opened = openExternal('https://accounts.x.ai/oauth2/device?user_code=84F2-MKGY', {
    platform: 'darwin',
    spawn: (command, args, options) => {
      calls.push({ command, args, options })
      queueMicrotask(() => child.emit('exit', 0))
      return child
    },
  })
  assert.equal(await opened, true)
  assert.equal(calls[0].command, 'open')
  assert.deepEqual(calls[0].args, [LOGIN_URL])
})

test('login returns the link immediately, then stores the session without a CLI', async () => {
  const { path, cleanup } = tempDir()
  const opened = []
  const bodies = []
  let polls = 0
  let sleeps = 0
  let releaseSleep
  const sleepGate = new Promise(resolve => { releaseSleep = resolve })
  let settled
  const done = new Promise(resolve => { settled = resolve })
  const fetchImpl = async (_url, init) => {
    bodies.push(init?.body)
    if (!init?.body) throw new Error('device and token calls are POST')
    if (polls === 0) {
      polls += 1
      return jsonResponse(200, {
        device_code: 'device-secret',
        user_code: '84F2-MKGY',
        verification_uri_complete: LOGIN_URL,
        expires_in: 600,
        interval: 0,
      })
    }
    polls += 1
    if (polls === 2) return jsonResponse(400, { error: 'authorization_pending' })
    if (polls === 3) return jsonResponse(400, { error: 'slow_down' })
    return jsonResponse(200, {
      access_token: 'access-new',
      refresh_token: 'refresh-new',
      expires_in: 3600,
    })
  }
  try {
    const service = createSessionService({
      authPath: path,
      readAuth: () => readOrEmpty(path),
      oauthEndpoints: ENDPOINTS,
      now: () => NOW,
      loadCatalog: async () => ({ models: [{ id: 'grok-4.7' }], source: 'live' }),
      fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
    })
    const started = await service.login({
      fetch: fetchImpl,
      sleep: async () => {
        sleeps += 1
        if (sleeps === 1) await sleepGate
      },
      openUrl: url => { opened.push(url) },
      onSettled: settled,
      now: () => NOW,
    })
    assert.equal(started.ok, true)
    assert.equal(started.pending, true)
    assert.equal(started.loginUrl, LOGIN_URL)
    assert.equal(started.userCode, '84F2-MKGY')
    assert.equal(started.deviceCode, undefined)
    assert.equal(started.account.signedIn, false)
    assert.deepEqual(opened, [LOGIN_URL])
    releaseSleep()
    await done
    const after = await service.status()
    assert.equal(after.account.signedIn, true)
    const stored = readGrokAuthSession(path)
    assert.equal(stored.session.accessToken, 'access-new')
    assert.equal(stored.session.refreshToken, 'refresh-new')
    assert.equal(stored.session.oidcClientId, GROK_OIDC_CLIENT_ID)
    assert.equal(stored.session.oidcIssuer, XAI_OAUTH_ISSUER)
    assert.equal(JSON.stringify(after).includes('refresh-new'), false)
    assert.equal(JSON.stringify(after).includes('device-secret'), false)
    const handler = createRpcHandler(service, { timeoutMs: 1000, loginTimeoutMs: 1000 })
    const rpcStatus = await handler('status', {}, undefined)
    assert.equal(JSON.stringify(rpcStatus).includes('refresh-new'), false)
    assert.equal(JSON.stringify(rpcStatus).includes('access-new'), false)
  } finally {
    cleanup()
  }
})

test('a denied device code does not write a session', async () => {
  const { path, cleanup } = tempDir()
  let calls = 0
  let settled
  const done = new Promise(resolve => { settled = resolve })
  const fetchImpl = async () => {
    calls += 1
    if (calls === 1) {
      return jsonResponse(200, {
        device_code: 'device-secret',
        user_code: '84F2-MKGY',
        verification_uri_complete: LOGIN_URL,
        expires_in: 60,
        interval: 0,
      })
    }
    return jsonResponse(400, { error: 'access_denied', error_description: 'The user denied the authorization request' })
  }
  try {
    const service = createSessionService({
      authPath: path,
      readAuth: () => readOrEmpty(path),
      oauthEndpoints: ENDPOINTS,
      now: () => NOW,
      loadCatalog: async () => ({ models: [], source: 'live' }),
      fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
    })
    const started = await service.login({ fetch: fetchImpl, sleep: async () => {}, openUrl: () => {}, onSettled: settled, now: () => NOW })
    assert.equal(started.pending, true)
    await done
    assert.equal((await service.status()).account.signedIn, false)
    assert.equal(readOrEmpty(path).session, undefined)
  } finally {
    cleanup()
  }
})

test('login endpoints get their own RPC ceiling', async () => {
  const handler = createRpcHandler(
    { login: async () => new Promise(() => {}) },
    { timeoutMs: 20, loginTimeoutMs: 45 },
  )
  const result = await handler('login/cli', {}, undefined)
  assert.equal(result.ok, false)
  assert.match(result.error.message, /timed out after 45ms/)
})
