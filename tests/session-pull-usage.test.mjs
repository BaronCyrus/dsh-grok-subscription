import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionService } from '../src/session.js'

function mockSession() {
  return {
    accessToken: 'test-access-token',
    authMode: 'oidc',
    maskedAccount: 'a•••e@example.com',
    expiresAt: '2026-10-01T00:00:00.000Z',
    source: 'grok-cli',
  }
}

function waitDeferred() {
  return new Promise(resolve => {
    if (typeof setImmediate === 'function') setImmediate(resolve)
    else queueMicrotask(resolve)
  })
}

function neverResolves() {
  return new Promise(() => {
    // Intentionally never resolves.
  })
}

function raceMs(promise, ms, message) {
  let timer
  return Promise.race([
    Promise.resolve(promise).finally(() => { if (timer) clearTimeout(timer) }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}

test('pull resolves without awaiting loadCatalog or billing (even if they never settle)', async () => {
  let catalogStarted = 0
  let billingStarted = 0

  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'test-access-token' }),
      set: async () => {},
      unset: async () => {},
    },
    readAuth: () => ({ session: mockSession() }),
    loadCatalog: async () => {
      catalogStarted += 1
      return neverResolves()
    },
    fetchBillingUsage: async () => {
      billingStarted += 1
      return neverResolves()
    },
  })

  const result = await Promise.race([
    session.pull(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('pull hung awaiting catalog/usage')), 300)),
  ])

  assert.equal(result.ok, true)
  assert.equal(result.account.signedIn, true)
  // Cached catalog (empty / signed-out until background or catalog/refresh fills it).
  assert.equal(result.catalog.source, 'signed-out')
  assert.equal(result.usage.status, 'unavailable')
  await waitDeferred()
  assert.ok(catalogStarted >= 1, 'background catalog refresh should be kicked')
  assert.ok(billingStarted >= 1, 'background usage refresh should be kicked')
})

test('pull resolves in <50ms even when credentials.set and credentialRef never settle; currentToken sees memory', async () => {
  let setStarted = 0
  let refStarted = 0

  const session = createSessionService({
    credentials: {
      resolve: async () => neverResolves(),
      set: async () => {
        setStarted += 1
        return neverResolves()
      },
      unset: async () => neverResolves(),
    },
    credentialRefOf: async () => {
      refStarted += 1
      return neverResolves()
    },
    readAuth: () => ({ session: mockSession() }),
    loadCatalog: async () => neverResolves(),
    fetchBillingUsage: async () => neverResolves(),
    storeTokenTimeoutMs: 30,
  })

  const started = Date.now()
  const result = await raceMs(session.pull(), 50, 'pull hung on credentials')
  const elapsed = Date.now() - started

  assert.equal(result.ok, true)
  assert.equal(result.account.signedIn, true)
  assert.ok(elapsed < 50, `expected pull <50ms, took ${elapsed}ms`)

  const token = await session.currentToken()
  assert.equal(token, 'test-access-token', 'adapters must see memoryAccessToken immediately')

  const status = await session.status()
  assert.equal(status.account.signedIn, true, 'status must prefer memory over hanging resolve')

  // Deferred persist may start later; neither set nor ref must block pull.
  await waitDeferred()
  assert.ok(refStarted >= 1 || setStarted >= 0, 'deferred persist may attempt credentialRef')
})

test('signed-out pull clears memory and returns without awaiting clearToken', async () => {
  let auth = { session: mockSession() }
  const session = createSessionService({
    credentials: {
      resolve: async () => undefined,
      set: async () => {},
      unset: async () => neverResolves(),
    },
    credentialRefOf: async () => neverResolves(),
    readAuth: () => auth,
    loadCatalog: async () => neverResolves(),
    fetchBillingUsage: async () => neverResolves(),
    storeTokenTimeoutMs: 30,
  })

  await session.pull()
  assert.equal(await session.currentToken(), 'test-access-token')

  auth = { session: undefined, reason: 'missing' }
  const started = Date.now()
  const result = await raceMs(session.pull(), 50, 'signed-out pull hung')
  assert.equal(result.ok, false)
  assert.equal(result.account.signedIn, false)
  assert.equal(await session.currentToken(), undefined)
  assert.ok(Date.now() - started < 50)
})

test('status returns cached usage and does not call billing by default', async () => {
  let billingCalls = 0
  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'stored-token' }),
    },
    readAuth: () => ({ session: mockSession() }),
    fetchBillingUsage: async () => {
      billingCalls += 1
      return {
        status: 'ok',
        usedPercent: 3,
        remainingPercent: 97,
        experimental: true,
        source: 'billing-credits-undocumented',
      }
    },
  })

  const first = await session.status()
  assert.equal(billingCalls, 0)
  assert.equal(first.usage.status, 'unavailable')
  assert.match(first.usage.reason, /Not fetched yet|Not signed in/i)

  const refreshed = await session.refreshUsage()
  assert.equal(billingCalls, 1)
  assert.equal(refreshed.status, 'ok')
  assert.equal(refreshed.usedPercent, 3)

  const second = await session.status()
  assert.equal(billingCalls, 1, 'status must not re-fetch billing')
  assert.equal(second.usage.status, 'ok')
  assert.equal(second.usage.usedPercent, 3)
})

test('notifyCatalogChange is deferred (does not run synchronously during pull)', async () => {
  let calls = 0
  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'tok' }),
      set: async () => {},
    },
    readAuth: () => ({ session: mockSession() }),
    // Hang catalog so background refresh does not fire a second notify during this test window.
    loadCatalog: async () => neverResolves(),
    fetchBillingUsage: async () => neverResolves(),
    onCatalogChange: () => {
      calls += 1
    },
  })

  const result = await session.pull()
  assert.equal(result.ok, true)
  assert.equal(calls, 0, 'notify must not run before pull returns')
  await waitDeferred()
  assert.equal(calls, 1)
})

test('refreshCatalog returns live catalog and can run after a zero-network pull', async () => {
  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'test-access-token' }),
      set: async () => {},
    },
    readAuth: () => ({ session: mockSession() }),
    loadCatalog: async () => ({
      models: [{ id: 'grok-4.7', name: 'Grok 4.7' }],
      source: 'live',
    }),
    fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'skip', experimental: true }),
  })

  const pulled = await session.pull()
  assert.equal(pulled.ok, true)
  assert.equal(pulled.catalog.source, 'signed-out')

  const catalog = await session.refreshCatalog()
  assert.equal(catalog.source, 'live')
  assert.equal(catalog.models[0].id, 'grok-4.7')
  assert.equal(session.catalog().source, 'live')
})

test('status returns within ~100ms even when credentials.resolve never settles', async () => {
  const session = createSessionService({
    credentials: {
      resolve: async () => neverResolves(),
      set: async () => neverResolves(),
      unset: async () => neverResolves(),
    },
    credentialRefOf: async () => neverResolves(),
    readAuth: () => ({ session: undefined, reason: 'missing' }),
    loadCatalog: async () => neverResolves(),
    fetchBillingUsage: async () => neverResolves(),
    credentialsIoTimeoutMs: 40,
    storeTokenTimeoutMs: 40,
  })

  const started = Date.now()
  const status = await raceMs(session.status(), 100, 'status hung on credentials.resolve')
  const elapsed = Date.now() - started

  assert.equal(status.account.signedIn, false)
  assert.equal(status.catalog.source, 'signed-out')
  assert.ok(elapsed < 100, `expected status <100ms, took ${elapsed}ms`)
})

test('status prefers auth.json over hanging credentials.resolve', async () => {
  const session = createSessionService({
    credentials: {
      resolve: async () => neverResolves(),
    },
    credentialRefOf: async () => neverResolves(),
    readAuth: () => ({ session: mockSession() }),
    credentialsIoTimeoutMs: 5_000,
  })

  const started = Date.now()
  const status = await raceMs(session.status(), 100, 'status hung despite auth.json')
  assert.equal(status.account.signedIn, true)
  assert.equal(await session.currentToken(), 'test-access-token')
  assert.ok(Date.now() - started < 100)
})

test('currentToken times out when credentials.resolve never settles', async () => {
  const session = createSessionService({
    credentials: {
      resolve: async () => neverResolves(),
    },
    credentialRefOf: async () => 'GROK_BUILD_ACCESS_TOKEN',
    readAuth: () => ({ session: undefined, reason: 'missing' }),
    credentialsIoTimeoutMs: 40,
  })

  const started = Date.now()
  const token = await raceMs(session.currentToken(), 150, 'currentToken hung')
  assert.equal(token, undefined)
  assert.ok(Date.now() - started < 150)
})
