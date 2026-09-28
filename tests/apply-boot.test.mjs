import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject as pluginInject } from '../src/index.js'
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

test('apply returns before the adapter import settles, and never blocks on it', async () => {
  const ctx = fakeCtx()
  let buildStarted = 0
  let deferredRuns = 0

  const started = Date.now()
  apply(ctx, {
    buildAdapter: async () => {
      buildStarted += 1
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
  assert.equal(ctx._adapters.size, 0, 'no route is claimed before the deferred tick')
  assert.equal(ctx._providers.length, 0, 'configurable providers deferred')
  assert.equal(buildStarted, 0, 'the adapter import must not start before the deferred tick')

  await waitMs(30)
  assert.equal(buildStarted, 1, 'the adapter build kicked on the deferred tick')
  assert.equal(ctx._providers.length, 1)
  assert.equal(ctx._providers[0].provider, PROVIDER_ID)
  // A hanging import must not wedge anything else: apply already returned and
  // the plugin list has rendered.
  await waitMs(20)
  assert.equal(ctx._adapters.size, 0, 'an unresolved adapter never claims the route')
})

test('apply tolerates a host without the credentials service', async () => {
  const ctx = fakeCtx() // get('credentials') -> undefined
  const deferred = []
  let seenSession
  apply(ctx, {
    buildAdapter: async session => {
      seenSession = session
      return { adapter: { listModels: async () => [] }, kind: 'pi-ai' }
    },
    skipSettings: true,
    skipPull: true,
    defer: run => deferred.push(run),
  })
  for (const run of deferred.splice(0)) run()
  await waitMs(10)
  assert.ok(seenSession, 'the plugin still builds its adapter without a credentials service')
  assert.ok(ctx._adapters.has(PROVIDER_ID))
})

test('inject stays lean (llm+web only)', () => {
  assert.deepEqual(pluginInject, ['llm', 'web'])
})

test('apply never emits llm/adapters-updated synchronously', async () => {
  const ctx = fakeCtx()
  let emits = 0
  ctx.emit = () => { emits += 1 }
  const deferred = []

  apply(ctx, {
    buildAdapter: async () => ({ adapter: { listModels: async () => [] }, kind: 'pi-ai' }),
    skipSettings: true,
    skipPull: true,
    defer: run => deferred.push(run),
  })

  assert.equal(emits, 0, 'emit must not run synchronously inside apply')
  for (const run of deferred.splice(0)) run()
  await waitMs(10)
  assert.equal(emits, 1, 'the deferred registration announces the new route once')
})
