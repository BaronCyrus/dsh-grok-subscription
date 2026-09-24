import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createSessionService, cliProxyEnv, openExternal, spawnGrokLogin } from '../src/session.js'
import { createRpcHandler } from '../src/rpc.js'

const NOW = Date.parse('2026-09-22T08:00:00Z')
const DEVICE_URL = 'https://accounts.x.ai/oauth2/device?user_code=84F2-MKGY'
const CLI_OUTPUT = `\nTo sign in, open this URL in your browser:\n\n  ${DEVICE_URL}\n\nConfirm this code in your browser:\n\n  84F2-MKGY\n\nWaiting for authorization...\n`

const grokSession = token => ({
  accessToken: token,
  expiresAt: new Date(NOW + 3_600_000).toISOString(),
  email: 'user@example.com',
  authMode: 'oidc',
  maskedAccount: 'u***@example.com',
})

/** A `grok login` child with piped stdio, the way the host reads its link. */
function fakeLoginChild() {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.killed = false
  child.kill = () => { child.killed = true }
  return child
}

const binOptions = { env: { DSH_GROK_BIN: '/opt/grok' }, exists: () => true }

// -------------------------------------------------------- CLI proxy (host-safe)

test('GROK_CLI_PROXY reaches the CLI without touching the host environment', () => {
  const base = { PATH: '/usr/bin', GROK_CLI_PROXY: 'http://127.0.0.1:10808' }
  const env = cliProxyEnv(base)
  assert.equal(env.http_proxy, 'http://127.0.0.1:10808')
  assert.equal(env.https_proxy, 'http://127.0.0.1:10808')
  assert.equal(env.all_proxy, 'http://127.0.0.1:10808')
  assert.equal(env.no_proxy, 'localhost,127.0.0.1,::1')
  assert.equal(base.http_proxy, undefined, 'the host environment must not be mutated')
})

test('a SOCKS proxy is declared only where it is meaningful', () => {
  const env = cliProxyEnv({ GROK_CLI_PROXY: 'socks5h://127.0.0.1:10808' })
  assert.equal(env.all_proxy, 'socks5h://127.0.0.1:10808')
  assert.equal(env.http_proxy, undefined)
})

test('GROK_CLI_NO_PROXY overrides the default bypass list', () => {
  const env = cliProxyEnv({
    GROK_CLI_PROXY: 'http://127.0.0.1:10808',
    GROK_CLI_NO_PROXY: 'localhost,cli-chat-proxy.grok.com',
  })
  assert.equal(env.no_proxy, 'localhost,cli-chat-proxy.grok.com')
})

test('explicit standard proxy variables win over GROK_CLI_PROXY', () => {
  const base = { http_proxy: 'http://corp.example:8080', GROK_CLI_PROXY: 'http://127.0.0.1:10808' }
  assert.equal(cliProxyEnv(base), base)
})

test('no proxy configuration leaves the environment untouched', () => {
  const base = { PATH: '/usr/bin' }
  assert.equal(cliProxyEnv(base), base)
})

test('the login spawn receives the derived proxy environment', async () => {
  const child = fakeLoginChild()
  let spawnedEnv
  const pending = spawnGrokLogin({
    env: { PATH: '/usr/bin', GROK_CLI_PROXY: 'http://127.0.0.1:10808' },
    spawn: (bin, args, options) => { spawnedEnv = options.env; return child },
    openUrl: () => {},
    startTimeoutMs: 20,
  })
  await pending
  assert.equal(spawnedEnv.http_proxy, 'http://127.0.0.1:10808')
})

// ------------------------------------------------------------------ the link

test('spawnGrokLogin answers with the link the CLI prints and opens it', async () => {
  const child = fakeLoginChild()
  const opened = []
  const pending = spawnGrokLogin({
    ...binOptions,
    spawn: () => child,
    openUrl: url => { opened.push(url) },
    startTimeoutMs: 50,
  })
  child.stderr.emit('data', CLI_OUTPUT)
  const result = await pending
  assert.equal(result.ok, true)
  assert.equal(result.pending, true)
  assert.equal(result.loginUrl, DEVICE_URL)
  assert.equal(result.userCode, '84F2-MKGY')
  assert.deepEqual(opened, [DEVICE_URL])
  // The child stays alive: authorization happens after this reply.
  assert.equal(result.child, child)
  assert.equal(child.killed, false)
})

test('a silent CLI answers without a link and is left running', async () => {
  const child = fakeLoginChild()
  const result = await spawnGrokLogin({ ...binOptions, spawn: () => child, startTimeoutMs: 20 })
  assert.equal(result.pending, true)
  assert.equal(result.loginUrl, undefined)
  assert.match(result.warning, /no sign-in URL/)
  assert.equal(child.killed, false)
})

test('a CLI that owns the terminal keeps the resolve-on-exit behaviour', async () => {
  const child = new EventEmitter()
  const pending = spawnGrokLogin({ ...binOptions, spawn: () => child, stdio: 'inherit' })
  child.emit('exit', 0)
  const result = await pending
  assert.equal(result.pending, false)
  assert.equal(result.loginUrl, undefined)
})

test('a non-zero exit before the link rejects', async () => {
  const child = fakeLoginChild()
  const pending = spawnGrokLogin({ ...binOptions, spawn: () => child, startTimeoutMs: 50 })
  const rejection = assert.rejects(pending, /exited with code 2/)
  child.emit('exit', 2)
  await rejection
})

test('openExternal drives the platform opener', async () => {
  const calls = []
  const child = new EventEmitter()
  child.unref = () => {}
  const opened = openExternal('https://example.test/x', {
    platform: 'darwin',
    spawn: (command, args, options) => {
      calls.push({ command, args, options })
      queueMicrotask(() => child.emit('exit', 0))
      return child
    },
  })
  assert.equal(await opened, true)
  assert.equal(calls[0].command, 'open')
  assert.deepEqual(calls[0].args, ['https://example.test/x'])
})

// ------------------------------------------------------------- the session

test('login replies while the browser round trip is pending, then syncs the session', async () => {
  let session
  const service = createSessionService({
    readAuth: () => ({ session, reason: undefined }),
    loadCatalog: async () => ({ models: [{ id: 'grok-4.7' }], source: 'live' }),
    fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
    now: () => NOW,
  })
  const child = fakeLoginChild()
  const pending = service.login({ ...binOptions, spawn: () => child, openUrl: () => {}, startTimeoutMs: 50 })
  child.stderr.emit('data', CLI_OUTPUT)
  const started = await pending
  assert.equal(started.ok, true)
  assert.equal(started.pending, true)
  assert.equal(started.loginUrl, DEVICE_URL)
  assert.equal(started.account.signedIn, false, 'authorization has not happened yet')

  // The CLI exits after the user confirms the code in the browser.
  session = grokSession('fresh-token')
  child.emit('exit', 0)
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  const after = await service.status()
  assert.equal(after.account.signedIn, true)
})

test('a CLI that finishes login itself syncs before the reply', async () => {
  const service = createSessionService({
    readAuth: () => ({ session: grokSession('token-1'), reason: undefined }),
    loadCatalog: async () => ({ models: [], source: 'live' }),
    fetchBillingUsage: async () => ({ status: 'unavailable', reason: 'test' }),
    now: () => NOW,
  })
  const child = new EventEmitter()
  const pending = service.login({ ...binOptions, spawn: () => child, openUrl: () => {}, stdio: 'inherit', startTimeoutMs: 5 })
  child.emit('exit', 0)
  const result = await pending
  assert.equal(result.pending, false)
  assert.equal(result.account.signedIn, true)
})

// ------------------------------------------------------------------- rpc cap

test('login endpoints get their own RPC ceiling', async () => {
  const handler = createRpcHandler(
    { login: async () => new Promise(() => {}) },
    { timeoutMs: 20, loginTimeoutMs: 45 },
  )
  const result = await handler('login/cli', {}, undefined)
  assert.equal(result.ok, false)
  assert.match(result.error.message, /timed out after 45ms/)
})
