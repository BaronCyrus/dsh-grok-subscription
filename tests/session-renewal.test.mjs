import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readGrokAuthSession, writeOauthSession } from '../src/auth-file.js'
import { createSessionService } from '../src/session.js'
import { GROK_OIDC_CLIENT_ID, TOKEN_EXPIRY_SKEW_MS, XAI_OAUTH_ISSUER } from '../src/constants.js'

const NOW = Date.parse('2026-09-22T08:00:00Z')
const iso = ms => new Date(ms).toISOString()

const grokSession = (token, expiresAtMs) => ({
  accessToken: token,
  expiresAt: expiresAtMs === undefined ? undefined : iso(expiresAtMs),
  email: 'user@example.com',
  authMode: 'oidc',
  maskedAccount: 'u***@example.com',
})

function sessionService({ session, renewSession, now = () => NOW }) {
  return createSessionService({
    readAuth: () => ({ session, reason: undefined }),
    renewSession,
    now,
    loadCatalog: async () => ({ models: [], source: 'live' }),
    fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
  })
}

// ------------------------------------------------------------ token renewal

test('an expired in-memory token is renewed through the refresh grant', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('stale', NOW - 1000),
    renewSession: async () => { renewals += 1; return grokSession('fresh', NOW + 6 * 3600_000) },
  })
  await service.status()
  assert.equal(await service.currentToken(), 'fresh')
  assert.equal(renewals, 1)
  // The renewed token is not renewed again while it is valid.
  assert.equal(await service.currentToken(), 'fresh')
  assert.equal(renewals, 1)
})

test('renewal starts before the token actually expires', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('about-to-die', NOW + TOKEN_EXPIRY_SKEW_MS - 1000),
    renewSession: async () => { renewals += 1; return grokSession('fresh', NOW + 6 * 3600_000) },
  })
  await service.status()
  assert.equal(await service.currentToken(), 'fresh')
  assert.equal(renewals, 1)
})

test('a valid token is not refreshed again', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('good', NOW + 3600_000),
    renewSession: async () => { renewals += 1; return grokSession('fresh', NOW + 6 * 3600_000) },
  })
  await service.status()
  assert.equal(await service.currentToken(), 'good')
  assert.equal(renewals, 0)
})

test('an unknown expiry is treated as usable rather than refreshed', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('no-expiry', undefined),
    renewSession: async () => { renewals += 1; return grokSession('fresh', NOW + 3600_000) },
  })
  await service.status()
  assert.equal(await service.currentToken(), 'no-expiry')
  assert.equal(renewals, 0)
})

test('concurrent reads share one renewal', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('stale', NOW - 1000),
    renewSession: async () => {
      renewals += 1
      await new Promise(resolve => setTimeout(resolve, 5))
      return grokSession('fresh', NOW + 6 * 3600_000)
    },
  })
  await service.status()
  const tokens = await Promise.all([service.currentToken(), service.currentToken(), service.currentToken()])
  assert.deepEqual(tokens, ['fresh', 'fresh', 'fresh'])
  assert.equal(renewals, 1)
})

test('a failed renewal keeps serving the stale token instead of signing out', async () => {
  const service = sessionService({
    session: grokSession('stale', NOW - 1000),
    renewSession: async () => { throw new Error('CLI unavailable') },
  })
  await service.status()
  assert.equal(await service.currentToken(), 'stale')
})

test('a renewal that returns no session keeps the stale token', async () => {
  const service = sessionService({
    session: grokSession('stale', NOW - 1000),
    renewSession: async () => undefined,
  })
  await service.status()
  assert.equal(await service.currentToken(), 'stale')
})

test('refreshToken forces renewal even for a token that is still valid', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('good', NOW + 3600_000),
    renewSession: async () => { renewals += 1; return grokSession('fresh', NOW + 6 * 3600_000) },
  })
  await service.status()
  assert.equal(await service.refreshToken(), 'fresh')
  assert.equal(renewals, 1)
})

test('default renewal posts a refresh grant and rewrites auth.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grok-refresh-'))
  const path = join(dir, 'auth.json')
  const endpoints = {
    deviceAuthorizationEndpoint: 'https://auth.x.ai/oauth2/device/code',
    tokenEndpoint: 'https://auth.x.ai/oauth2/token',
  }
  writeOauthSession(path, {
    issuer: XAI_OAUTH_ISSUER,
    clientId: GROK_OIDC_CLIENT_ID,
    accessToken: 'stale',
    refreshToken: 'refresh-old',
    expiresAt: iso(NOW - 1000),
    email: 'user@example.com',
  })
  let body = ''
  const fetchImpl = async (_url, init) => {
    body = init.body
    return {
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ access_token: 'fresh', refresh_token: 'refresh-new', expires_in: 3600 }),
    }
  }
  try {
    const service = createSessionService({
      authPath: path,
      readAuth: () => readGrokAuthSession(path),
      fetch: fetchImpl,
      oauthEndpoints: endpoints,
      now: () => NOW,
      loadCatalog: async () => ({ models: [], source: 'live' }),
      fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
    })
    await service.status()
    assert.equal(await service.currentToken(), 'fresh')
    assert.match(body, /grant_type=refresh_token/)
    assert.match(body, /refresh_token=refresh-old/)
    const stored = readGrokAuthSession(path)
    assert.equal(stored.session.accessToken, 'fresh')
    assert.equal(stored.session.refreshToken, 'refresh-new')
    assert.equal(JSON.stringify(await service.status()).includes('refresh-new'), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
