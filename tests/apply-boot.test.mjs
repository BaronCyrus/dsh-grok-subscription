import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../src/index.js'
import { PROVIDER_ID } from '../src/constants.js'

function neverResolves() {
  return new Promise(() => {
    // Intentionally never resolves.
  })
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fakeCtx() {
  const adapters = new Map()
  const providers = []
  return {
    logger: {
      debug() {},
      warn() {},
    },
    llm: {
      registerAdapter(ids, adapter) {
        for (const id of ids) adapters.set(id, adapter)
      },
      registerConfigurableProviders(list) {
        providers.push(...list)
      },
    },
    emit() {},
    effect() {},
    inject() {},
    get(key) {
      if (key === 'credentials') return undefined
      if (key === 'settings') return undefined
      return undefined
    },
    _adapters: adapters,
    _providers: providers,
  }
}

test('apply registers duck adapter sync and returns without awaiting hanging upgrade import', async () => {
  const ctx = fakeCtx()
  let upgradeStarted = 0
  let deferredRuns = 0

  const started = Date.now()
  apply(ctx, {
    createSync: session => ({
      adapter: {
        listModels: async () => [],
        providerInfo: () => ({ id: PROVIDER_ID, name: 'test' }),
      },
      kind: 'custom-mvp',
      note: 'test-duck',
      session,
    }),
    createAsync: async () => {
      upgradeStarted += 1
      return neverResolves()
    },
    defer: run => {
      deferredRuns += 1
      // Run deferred work after apply returns (simulate setImmediate).
      setImmediate(run)
    },
    skipSettings: true,
    skipPull: true,
  })
  const elapsed = Date.now() - started

  assert.ok(elapsed < 50, `apply should return immediately, took ${elapsed}ms`)
  assert.equal(deferredRuns, 1)
  assert.ok(ctx._adapters.has(PROVIDER_ID), 'duck adapter registered synchronously')
  assert.equal(ctx._providers.length, 0, 'configurable providers deferred')
  assert.equal(upgradeStarted, 0, 'upgrade must not start before deferred tick')

  await waitMs(30)
  assert.equal(upgradeStarted, 1, 'upgrade kicked on deferred tick')
  assert.equal(ctx._providers.length, 1)
  assert.equal(ctx._providers[0].provider, PROVIDER_ID)
  // Still no hang: hanging upgrade must not block further progress.
  await waitMs(20)
  assert.ok(ctx._adapters.has(PROVIDER_ID))
})

test('apply soft-gets credentials and never requires inject listing', async () => {
  const ctx = fakeCtx()
  let seenCredentials
  apply(ctx, {
    createSync: session => {
      seenCredentials = session
      return {
        adapter: { listModels: async () => [] },
        kind: 'custom-mvp',
      }
    },
    skipSettings: true,
    skipPull: true,
    skipUpgrade: true,
    defer: () => {},
  })
  assert.ok(seenCredentials, 'session created')
  assert.ok(ctx._adapters.has(PROVIDER_ID))
})
