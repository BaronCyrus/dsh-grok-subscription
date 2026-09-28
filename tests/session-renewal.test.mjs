import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createSessionService, spawnGrokRefresh } from '../src/session.js'
import { TOKEN_EXPIRY_SKEW_MS } from '../src/constants.js'

const NOW = Date.parse('2026-09-22T08:00:00Z')
const iso = ms => new Date(ms).toISOString()

const grokSession = (token, expiresAtMs) => ({
  accessToken: token,
  expiresAt: expiresAtMs === undefined ? undefined : iso(expiresAtMs),
  email: 'user@example.com',
  authMode: 'oidc',
  maskedAccount: 'u***@example.com',
})

const afterSpawn = () => new Promise(resolve => setImmediate(resolve))

function fakeChild() {
  const child = new EventEmitter()
  child.killed = false
  child.kill = () => { child.killed = true }
  return child
}

function sessionService({ session, renewSession, now = () => NOW }) {
  return createSessionService({
    readAuth: () => ({ session, reason: undefined }),
    renewSession,
    now,
    loadCatalog: async () => ({ models: [], source: 'live' }),
    fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
  })
}

// ---------------------------------------------------------------- CLI spawn

test('spawnGrokRefresh runs `grok models` and resolves on exit', async () => {
  const child = fakeChild()
  const calls = []
  const pending = spawnGrokRefresh({
    spawn: (bin, args, options) => { calls.push({ bin, args, options }); return child },
    env: { DSH_GROK_BIN: '/opt/grok' },
    exists: () => true,
  })
  await afterSpawn()
  child.emit('exit', 0)
  const result = await pending
  assert.equal(calls.length, 1)
  assert.equal(calls[0].bin, '/opt/grok')
  assert.deepEqual(calls[0].args, ['models'])
  assert.equal(result.ok, true)
  assert.equal(result.code, 0)
})

test('spawnGrokRefresh treats a non-zero exit as done, not as failure', async () => {
  // The CLI exits 0 even when it says "You are not authenticated", and can exit
  // non-zero after a successful refresh, so only the re-read can judge.
  const child = fakeChild()
  const pending = spawnGrokRefresh({
    spawn: () => child,
    env: { DSH_GROK_BIN: '/opt/grok' },
    exists: () => true,
  })
  await afterSpawn()
  child.emit('exit', 1)
  assert.deepEqual(await pending, { ok: true, code: 1 })
})

test('spawnGrokRefresh kills a hanging CLI', async () => {
  const child = fakeChild()
  const result = await spawnGrokRefresh({
    spawn: () => child,
    env: { DSH_GROK_BIN: '/opt/grok' },
    exists: () => true,
    timeoutMs: 10,
  })
  assert.deepEqual(result, { ok: false, reason: 'timeout' })
  assert.equal(child.killed, true)
})

test('spawnGrokRefresh surfaces a spawn error', async () => {
  const child = fakeChild()
  const pending = spawnGrokRefresh({
    spawn: () => child,
    env: { DSH_GROK_BIN: '/opt/grok' },
    exists: () => true,
  })
  await afterSpawn()
  child.emit('error', new Error('ENOENT'))
  await assert.rejects(pending, /Could not run grok CLI/)
})

// ------------------------------------------------------------ token renewal

test('an expired in-memory token is renewed through the CLI', async () => {
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

test('a valid token never spawns the CLI', async () => {
  let renewals = 0
  const service = sessionService({
    session: grokSession('good', NOW + 3600_000),
    renewSession: async () => { renewals += 1; return grokSession('fresh', NOW + 6 * 3600_000) },
  })
  await service.status()
  assert.equal(await service.currentToken(), 'good')
  assert.equal(renewals, 0)
})

test('an unknown expiry is treated as usable rather than spawning the CLI', async () => {
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
