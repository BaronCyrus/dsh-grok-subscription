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

test('pull fails fast when credentials.set never resolves (storeToken timeout)', async () => {
  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'test-access-token' }),
      set: async () => neverResolves(),
      unset: async () => {},
    },
    readAuth: () => ({ session: mockSession() }),
    loadCatalog: async () => neverResolves(),
    fetchBillingUsage: async () => neverResolves(),
    storeTokenTimeoutMs: 40,
  })

  const started = Date.now()
  await assert.rejects(
    () => session.pull(),
    error => {
      assert.match(String(error?.message ?? error), /timed out after 40ms/i)
      return true
    },
  )
  const elapsed = Date.now() - started
  assert.ok(elapsed < 300, `expected fast timeout, took ${elapsed}ms`)
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
