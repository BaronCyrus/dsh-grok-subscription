import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../src/index.js'
import { PROVIDER_ID } from '../src/constants.js'

/**
 * The host's adapter registry, narrowed to what this plugin depends on:
 * `registerAdapter` refuses a provider that already has an adapter
 * (`DUPLICATE_ADAPTER`, all-or-nothing) and returns a callable handle whose call
 * releases the routes.
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

const adapter = { providerInfo: provider => ({ id: provider, name: 'pi-ai' }) }
const settle = () => new Promise(resolve => setImmediate(resolve))

/** Runs apply with a captured deferred step, then drains it on demand. */
function boot(overrides = {}) {
  const llm = hostLlm()
  const { ctx, warnings } = pluginContext(llm)
  const deferred = []
  let built = 0

  apply(ctx, {
    buildAdapter: async () => {
      built += 1
      return { adapter, kind: 'pi-ai' }
    },
    defer: run => deferred.push(run),
    skipSettings: true,
    skipPull: true,
    ...overrides,
  })

  return {
    llm,
    warnings,
    deferred,
    built: () => built,
    drain: async () => {
      for (const run of deferred.splice(0)) run()
      await settle()
    },
  }
}

test('apply returns before the adapter is built, then registers exactly once', async () => {
  const run = boot()

  // apply must not await the pi-ai imports: the loader renders the plugin list
  // while apply is pending, which is what wedged Settings in 0.1.9 and earlier.
  assert.equal(run.built(), 0, 'no adapter is built inside apply')
  assert.equal(run.llm.routes.size, 0, 'no route is claimed inside apply')
  assert.equal(run.deferred.length, 1)

  await run.drain()

  assert.equal(run.built(), 1)
  assert.deepEqual(run.llm.attempts, [adapter], 'the route is claimed exactly once')
  assert.equal(run.llm.routes.get(PROVIDER_ID), adapter)
  assert.deepEqual(run.warnings, [])
})

test('an unavailable host adapter registers nothing and reports why', async () => {
  const run = boot({
    buildAdapter: async () => ({
      adapter: undefined,
      kind: 'unavailable',
      note: 'the host pi-ai adapter is unavailable',
    }),
  })

  await run.drain()

  assert.equal(run.llm.routes.size, 0, 'no substitute adapter is invented')
  assert.equal(run.warnings.length, 1)
  assert.match(run.warnings[0], /adapter is unavailable/u)
  assert.match(run.warnings[0], /pi-ai adapter is unavailable/u)
})

test('a registration the host refuses is reported instead of leaving a dead route', async () => {
  const run = boot()
  run.llm.registerAdapter = () => {
    throw Object.assign(new Error('registry is closed'), { code: 'INVALID_ADAPTER' })
  }

  await run.drain()

  assert.equal(run.llm.routes.size, 0)
  assert.equal(run.warnings.length, 1)
  assert.match(run.warnings[0], /adapter registration failed/u)
  assert.match(run.warnings[0], /registry is closed/u)
})

test('the host refuses a second adapter for a live provider', () => {
  const llm = hostLlm()
  llm.registerAdapter([PROVIDER_ID], adapter)
  assert.throws(
    () => llm.registerAdapter([PROVIDER_ID], adapter),
    error => error.code === 'DUPLICATE_ADAPTER',
    'the fake must model the host rule the single registration relies on',
  )
})
