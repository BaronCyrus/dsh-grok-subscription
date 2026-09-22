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

test('pull resolves without awaiting billing usage (even if billing never settles)', async () => {
  let billingStarted = 0
  let billingSettled = false
  const neverResolves = () => {
    billingStarted += 1
    return new Promise(() => {
      // Intentionally never resolves — Pull must not await this.
    })
  }

  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'test-access-token' }),
      set: async () => {},
      unset: async () => {},
    },
    readAuth: () => ({ session: mockSession() }),
    loadCatalog: async () => ({
      models: [{ id: 'grok-4.7', name: 'Grok 4.7' }],
      source: 'live',
    }),
    fetchBillingUsage: neverResolves,
  })

  const result = await Promise.race([
    session.pull(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('pull hung awaiting usage')), 300)),
  ])

  assert.equal(result.ok, true)
  assert.equal(result.catalog.source, 'live')
  assert.equal(result.account.signedIn, true)
  // Cached / not-yet-fetched usage is returned; billing may start in background.
  assert.equal(result.usage.status, 'unavailable')
  assert.equal(billingSettled, false)
  // Allow the deferred background kick to schedule.
  await waitDeferred()
  assert.ok(billingStarted >= 1, 'background usage refresh should be kicked')
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
    loadCatalog: async () => ({ models: [], source: 'fallback' }),
    fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'skip', experimental: true }),
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
