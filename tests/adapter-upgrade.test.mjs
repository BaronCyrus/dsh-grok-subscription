import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adapterOverride, apply, upgradeProviderAdapter } from '../src/index.js'
import { PROVIDER_ID } from '../src/constants.js'

/**
 * The host's adapter registry narrowed to what this plugin depends on:
 * `registerAdapter` refuses a provider that already has an adapter
 * (`DUPLICATE_ADAPTER`, all-or-nothing) and returns a callable handle whose call
 * releases the routes. `@deepseek-ai/dsh-llm` implements exactly this in every
 * release the peer range admits — the 0.1.5-rc.2 and 0.2.0-rc.1 builds of
 * `registerAdapter` are byte-identical, and the check reaches back to
 * 0.1.2-alpha.5.
 */
function hostLlm() {
  const routes = new Map()
  const attempts = []
  return {
    routes,
    attempts,
    registerAdapter(providers, adapter) {
      attempts.push(adapter)
      for (const provider of providers) {
        if (routes.has(provider)) {
          const error = new Error(`an adapter for provider "${provider}" is already registered`)
          error.code = 'DUPLICATE_ADAPTER'
          throw error
        }
      }
      for (const provider of providers) routes.set(provider, adapter)
      const handle = () => {
        for (const provider of providers) routes.delete(provider)
      }
      handle.replace = () => {}
      return handle
    },
    registerConfigurableProviders() {
      return () => {}
    },
  }
}

function pluginContext(llm) {
  const warnings = []
  return {
    ctx: {
      logger: {
        debug() {},
        warn(...args) {
          warnings.push(args.map(String).join(' '))
        },
      },
      llm,
      emit() {},
      effect() {},
      inject() {},
      get() {
        return undefined
      },
    },
    warnings,
  }
}

const adapterNamed = name => ({ name, providerInfo: provider => ({ id: provider, name }) })

const settle = () => new Promise(resolve => setImmediate(resolve))

/** Runs apply with a captured deferred step, then drains it on demand. */
function boot(overrides = {}) {
  const llm = hostLlm()
  const { ctx, warnings } = pluginContext(llm)
  const duck = adapterNamed('duck')
  const piAi = adapterNamed('pi-ai')
  const deferred = []
  let upgrades = 0

  apply(ctx, {
    createSync: () => ({ adapter: duck, kind: 'custom-mvp' }),
    createAsync: async () => {
      upgrades += 1
      return { adapter: piAi, kind: 'pi-ai' }
    },
    defer: run => deferred.push(run),
    skipSettings: true,
    skipPull: true,
    ...overrides,
  })

  return {
    llm,
    warnings,
    duck,
    piAi,
    deferred,
    upgrades: () => upgrades,
    drain: async () => {
      for (const run of deferred.splice(0)) run()
      await settle()
    },
  }
}

test('the deferred upgrade takes the route over instead of being refused', async () => {
  const run = boot()

  // apply stays synchronous: the bundled adapter serves the route before the upgrade.
  assert.equal(run.llm.routes.get(PROVIDER_ID), run.duck)
  assert.equal(run.deferred.length, 1)

  await run.drain()

  assert.deepEqual(run.llm.attempts, [run.duck, run.piAi], 'the upgrade registers after the bundled adapter')
  assert.equal(run.llm.routes.get(PROVIDER_ID), run.piAi, 'the official pi-ai adapter serves the route')
  assert.deepEqual(run.warnings, [], 'an admitted upgrade must not warn')
})

test('a refused upgrade puts the bundled adapter back and warns', async () => {
  const run = boot()
  const register = run.llm.registerAdapter.bind(run.llm)
  let calls = 0
  run.llm.registerAdapter = (providers, adapter) => {
    calls += 1
    // boot() registered the bundled adapter before this override was installed,
    // so the upgrade is the first call it sees: refuse that one and admit the
    // restore that follows.
    if (calls === 1) throw Object.assign(new Error('adapter rejected'), { code: 'INVALID_ADAPTER' })
    return register(providers, adapter)
  }

  await run.drain()

  assert.equal(run.llm.routes.get(PROVIDER_ID), run.duck, 'the route is never left unserved')
  assert.equal(run.warnings.length, 1)
  assert.match(run.warnings[0], /adapter upgrade failed/u)
  assert.match(run.warnings[0], /adapter rejected/u)
})

test('DSH_GROK_ADAPTER=fallback keeps the bundled adapter', async () => {
  const previous = process.env.DSH_GROK_ADAPTER
  process.env.DSH_GROK_ADAPTER = 'fallback'
  try {
    assert.equal(adapterOverride(), 'fallback')
    const run = boot()
    await run.drain()

    assert.equal(run.upgrades(), 0, 'the rollback switch must not even build the pi-ai adapter')
    assert.equal(run.llm.routes.get(PROVIDER_ID), run.duck)
    assert.deepEqual(run.warnings, [])
  } finally {
    if (previous === undefined) delete process.env.DSH_GROK_ADAPTER
    else process.env.DSH_GROK_ADAPTER = previous
  }
})

test('the rollback switch is opt-in and whitespace tolerant', () => {
  assert.equal(adapterOverride({}), undefined)
  assert.equal(adapterOverride({ DSH_GROK_ADAPTER: '' }), undefined)
  assert.equal(adapterOverride({ DSH_GROK_ADAPTER: 'host' }), undefined)
  assert.equal(adapterOverride({ DSH_GROK_ADAPTER: ' Fallback ' }), 'fallback')
})

test('a host that refuses both leaves the failure to the caller', () => {
  const llm = hostLlm()
  const { ctx } = pluginContext(llm)
  const duck = adapterNamed('duck')
  const piAi = adapterNamed('pi-ai')
  const registration = { adapter: duck, release: llm.registerAdapter([PROVIDER_ID], duck) }
  llm.registerAdapter = () => {
    throw Object.assign(new Error('registry is closed'), { code: 'INVALID_ADAPTER' })
  }

  assert.throws(() => upgradeProviderAdapter(ctx, piAi, registration), /registry is closed/u)
  assert.equal(registration.adapter, undefined)
  assert.equal(registration.release, undefined)
})

test('the upgrade releases the bundled route before claiming it again', () => {
  const llm = hostLlm()
  const { ctx } = pluginContext(llm)
  const duck = adapterNamed('duck')
  const piAi = adapterNamed('pi-ai')
  const registration = { adapter: duck, release: llm.registerAdapter([PROVIDER_ID], duck) }

  // A host that kept the old adapter registered would throw here; the release
  // inside the upgrade is what makes the second claim admissible.
  upgradeProviderAdapter(ctx, piAi, registration)

  assert.equal(llm.routes.get(PROVIDER_ID), piAi)
  assert.equal(registration.adapter, piAi)
  assert.equal(typeof registration.release, 'function')
})

test('the host refuses a second adapter for a live provider', () => {
  const llm = hostLlm()
  llm.registerAdapter([PROVIDER_ID], adapterNamed('duck'))
  assert.throws(
    () => llm.registerAdapter([PROVIDER_ID], adapterNamed('pi-ai')),
    error => error.code === 'DUPLICATE_ADAPTER',
    'the fake must model the host rule the upgrade has to work around',
  )
})
