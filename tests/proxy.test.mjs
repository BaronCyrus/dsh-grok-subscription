import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GROK_API_HOSTS,
  apiProxyUrl,
  ensureApiRouting,
  resetApiRouting,
  setRoutingDependencies,
} from '../src/proxy.js'
import { fetchLiveCatalog } from '../src/catalog.js'

/** Minimal undici surface: records what the routing agent was built with. */
function fakeUndici() {
  const state = { set: [], proxyAgents: [], pools: [] }
  class FakeProxyAgent {
    constructor(url) {
      this.url = url
      state.proxyAgents.push(url)
    }
  }
  class FakePool {
    constructor(origin, options) {
      this.origin = origin
      this.options = options
      state.pools.push(origin)
    }
  }
  let current = { name: 'host-dispatcher' }
  class FakeAgent {
    constructor(options) {
      this.options = options
      state.routing = options
    }
    route(origin) {
      return this.options.factory(origin, { name: 'pool-options' })
    }
  }
  return {
    state,
    undici: {
      Agent: FakeAgent,
      Pool: FakePool,
      ProxyAgent: FakeProxyAgent,
      getGlobalDispatcher: () => current,
      setGlobalDispatcher: next => { current = next; state.set.push(next) },
    },
    current: () => current,
  }
}

test('GROK_API_PROXY wins, GROK_PROXY is the shared knob', () => {
  assert.equal(apiProxyUrl({ GROK_PROXY: 'http://127.0.0.1:10808' }), 'http://127.0.0.1:10808')
  assert.equal(
    apiProxyUrl({ GROK_PROXY: 'http://127.0.0.1:10808', GROK_API_PROXY: 'http://127.0.0.1:9999' }),
    'http://127.0.0.1:9999',
  )
  assert.equal(apiProxyUrl({}), undefined)
  assert.equal(apiProxyUrl({ GROK_PROXY: '   ' }), undefined)
})

test('no configuration leaves the host dispatcher alone', async () => {
  const fake = fakeUndici()
  resetApiRouting()
  setRoutingDependencies({ undici: fake.undici, hostProxies: async () => false })
  assert.equal(await ensureApiRouting({}), 'direct')
  assert.deepEqual(fake.state.set, [])
  setRoutingDependencies({})
})

test('a configured tunnel routes only the Grok origin', async () => {
  const fake = fakeUndici()
  resetApiRouting()
  setRoutingDependencies({ undici: fake.undici, hostProxies: async () => false })
  assert.equal(await ensureApiRouting({ GROK_PROXY: 'http://127.0.0.1:10808' }), 'plugin')
  assert.equal(fake.state.set.length, 1)
  assert.deepEqual(fake.state.proxyAgents, ['http://127.0.0.1:10808'])
  assert.equal(await ensureApiRouting({ GROK_PROXY: 'http://127.0.0.1:10808' }), 'plugin')
  assert.equal(fake.state.set.length, 1, 'installing twice must be idempotent')

  const routing = fake.state.set[0]
  assert.ok(routing.route(`https://${GROK_API_HOSTS[0]}`) instanceof fake.undici.ProxyAgent)
  const other = routing.route('https://api.deepseek.com')
  assert.ok(other instanceof fake.undici.Pool)
  assert.equal(other.origin, 'https://api.deepseek.com')

  assert.equal(resetApiRouting(), true)
  assert.equal(fake.current().name, 'host-dispatcher', 'the previous dispatcher comes back')
  setRoutingDependencies({})
})

test('a host that already routes the origin is left untouched', async () => {
  const fake = fakeUndici()
  resetApiRouting()
  setRoutingDependencies({ undici: fake.undici, hostProxies: async () => true })
  assert.equal(await ensureApiRouting({ GROK_PROXY: 'http://127.0.0.1:10808' }), 'host')
  assert.deepEqual(fake.state.set, [])
  setRoutingDependencies({})
})

test('a SOCKS URL cannot become a routing agent here', async () => {
  const fake = fakeUndici()
  resetApiRouting()
  setRoutingDependencies({ undici: fake.undici, hostProxies: async () => false })
  assert.equal(await ensureApiRouting({ GROK_PROXY: 'socks5h://127.0.0.1:10808' }), 'direct')
  assert.deepEqual(fake.state.set, [])
  setRoutingDependencies({})
})

test('the catalog request goes out while the route is installed', async () => {
  const fake = fakeUndici()
  resetApiRouting()
  setRoutingDependencies({ undici: fake.undici, hostProxies: async () => false })
  const models = await fetchLiveCatalog('token', {
    env: { GROK_PROXY: 'http://127.0.0.1:10808' },
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => Buffer.from(JSON.stringify({ data: [{ id: 'grok-4.7' }] })),
    }),
  })
  assert.deepEqual(models.map(model => model.id), ['grok-4.7'])
  assert.equal(fake.state.proxyAgents.length, 1)
  resetApiRouting()
  setRoutingDependencies({})
})
