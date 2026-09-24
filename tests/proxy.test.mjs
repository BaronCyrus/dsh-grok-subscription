import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiProxyUrl, grokFetch, hostProxyEnvironment, resetGrokFetch, setProxyDependencies } from '../src/proxy.js'
import { fetchLiveCatalog } from '../src/catalog.js'

/** Stand-in for the host undici: records the dispatcher its own fetch received. */
function fakeUndici() {
  const seen = []
  class FakeProxyAgent {
    constructor(url) {
      this.url = url
    }
  }
  return {
    seen,
    undici: {
      ProxyAgent: FakeProxyAgent,
      fetch: async (url, init) => {
        seen.push({ url, dispatcher: init?.dispatcher })
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          arrayBuffer: async () => Buffer.from(JSON.stringify({ data: [{ id: 'grok-4.7' }] })),
        }
      },
    },
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

test('no tunnel leaves the caller on the global fetch', async () => {
  resetGrokFetch()
  setProxyDependencies({ hostProxies: async () => false })
  assert.equal(await grokFetch({}), undefined)
  setProxyDependencies({})
})

test('a SOCKS URL cannot be a ProxyAgent, so the caller stays on the global fetch', async () => {
  resetGrokFetch()
  setProxyDependencies({ hostProxies: async () => false })
  assert.equal(await grokFetch({ GROK_PROXY: 'socks5h://127.0.0.1:10808' }), undefined)
  setProxyDependencies({})
})

test('the tunnel fetch is the host undici fetch, not the global one, and it is reused', async () => {
  resetGrokFetch()
  const fake = fakeUndici()
  setProxyDependencies({ undici: fake.undici, hostProxies: async () => false })
  const first = await grokFetch({ GROK_PROXY: 'http://127.0.0.1:10808' })
  const second = await grokFetch({ GROK_PROXY: 'http://127.0.0.1:10808' })
  assert.equal(first, second)
  const response = await first('https://cli-chat-proxy.grok.com/v1/models-v2', { method: 'GET' })
  assert.equal(response.status, 200)
  assert.equal(fake.seen.length, 1)
  assert.ok(fake.seen[0].dispatcher instanceof fake.undici.ProxyAgent)
  assert.equal(fake.seen[0].dispatcher.url, 'http://127.0.0.1:10808')
  resetGrokFetch()
  setProxyDependencies({})
})

test('a host that already proxies the origin is left to its own fetch', async () => {
  resetGrokFetch()
  const fake = fakeUndici()
  setProxyDependencies({ undici: fake.undici, hostProxies: async () => true })
  assert.equal(await grokFetch({ GROK_PROXY: 'http://127.0.0.1:10808' }), undefined)
  assert.equal(fake.seen.length, 0)
  setProxyDependencies({})
})

test('the catalog uses that fetch and never the global dispatcher', async () => {
  resetGrokFetch()
  const fake = fakeUndici()
  setProxyDependencies({ undici: fake.undici, hostProxies: async () => false })
  const models = await fetchLiveCatalog('token', { env: { GROK_PROXY: 'http://127.0.0.1:10808' } })
  assert.deepEqual(models.map(model => model.id), ['grok-4.7'])
  assert.equal(fake.seen[0].url, 'https://cli-chat-proxy.grok.com/v1/models-v2')
  resetGrokFetch()
  setProxyDependencies({})
})

test('an injected fetch is used as-is, so tests and callers stay in control', async () => {
  resetGrokFetch()
  setProxyDependencies({ hostProxies: async () => false })
  let used = false
  const models = await fetchLiveCatalog('token', {
    env: { GROK_PROXY: 'http://127.0.0.1:10808' },
    fetch: async () => {
      used = true
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        arrayBuffer: async () => Buffer.from(JSON.stringify({ data: [{ id: 'grok-4.6' }] })),
      }
    },
  })
  assert.equal(used, true)
  assert.deepEqual(models.map(model => model.id), ['grok-4.6'])
  setProxyDependencies({})
})

test('the host child-environment overlay is returned only when it names a proxy', async () => {
  setProxyDependencies({
    hostProxyEnv: () => ({ https_proxy: 'http://127.0.0.1:10808', NODE_USE_ENV_PROXY: '1' }),
  })
  const overlay = await hostProxyEnvironment()
  assert.equal(overlay.https_proxy, 'http://127.0.0.1:10808')
  setProxyDependencies({ hostProxyEnv: () => ({}) })
  assert.equal(await hostProxyEnvironment(), undefined)
  setProxyDependencies({})
})
