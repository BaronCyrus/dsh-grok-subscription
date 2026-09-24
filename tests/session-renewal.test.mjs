import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createSessionService, spawnGrokRefresh } from '../src/session.js'
import { createDuckAdapter } from '../src/adapter.js'
import { PROVIDER_ID, TOKEN_EXPIRY_SKEW_MS } from '../src/constants.js'

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

// --------------------------------------------------------- provider 401 path

const encoder = new TextEncoder()
function sseResponse(frames) {
  const text = frames.map(frame => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join('')
  return new Response(new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode(text)); controller.close() },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const okFrames = [
  { type: 'response.output_text.delta', delta: 'hello' },
  { type: 'response.completed', response: { status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 1 } } },
]

async function runStream(session, fetchImpl) {
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const duck = createDuckAdapter(session)
    const chunks = []
    for await (const chunk of duck.stream({
      provider: PROVIDER_ID,
      model: 'grok-4.7',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })) chunks.push(chunk)
    return chunks
  } finally {
    globalThis.fetch = original
  }
}

function fakeSession({ token = 'stale', renewed = 'fresh' } = {}) {
  return {
    publicAccount: () => ({ signedIn: true }),
    models: () => [],
    currentToken: async () => token,
    refreshToken: async () => renewed,
    logout: async () => {},
  }
}

test('a provider 401 renews the token and retries once', async () => {
  let calls = 0
  const chunks = await runStream(fakeSession(), async () => {
    calls += 1
    if (calls === 1) return new Response('nope', { status: 401 })
    return sseResponse(okFrames)
  })
  assert.equal(calls, 2, 'the call must be retried exactly once')
  assert.equal(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join(''), 'hello')
  assert.equal(chunks.at(-1).reason.kind, 'stop')
})

test('a second 401 is not retried again', async () => {
  let calls = 0
  const chunks = await runStream(fakeSession(), async () => {
    calls += 1
    return new Response('nope', { status: 401 })
  })
  assert.equal(calls, 2, 'at most one retry')
  assert.equal(chunks.at(-1).reason.kind, 'error')
  assert.equal(chunks.at(-1).reason.failure.code, 'UNAUTHORIZED')
  assert.equal(chunks.at(-1).reason.failure.status, 401)
})

test('a non-401 failure is not retried and does not renew', async () => {
  let calls = 0
  let renewals = 0
  const session = fakeSession()
  session.refreshToken = async () => { renewals += 1; return 'fresh' }
  const chunks = await runStream(session, async () => {
    calls += 1
    return new Response('boom', { status: 500 })
  })
  assert.equal(calls, 1)
  assert.equal(renewals, 0)
  assert.equal(chunks.at(-1).reason.failure.status, 500)
})

test('a renewal that yields no new token surfaces the original 401', async () => {
  let calls = 0
  const session = fakeSession()
  session.refreshToken = async () => undefined
  const chunks = await runStream(session, async () => {
    calls += 1
    return new Response('nope', { status: 401 })
  })
  assert.equal(calls, 1, 'no retry without a fresh token')
  assert.equal(chunks.at(-1).reason.failure.code, 'UNAUTHORIZED')
})

test('a session without refreshToken still reports the 401 cleanly', async () => {
  const session = fakeSession()
  delete session.refreshToken
  let calls = 0
  const chunks = await runStream(session, async () => {
    calls += 1
    return new Response('nope', { status: 401 })
  })
  assert.equal(calls, 1)
  assert.equal(chunks.at(-1).reason.failure.status, 401)
})
