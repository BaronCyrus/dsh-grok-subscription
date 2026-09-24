/**
 * Tunnel for this plugin's own Grok requests — and nothing else.
 *
 * Two approaches that look simpler both break the host:
 *
 * - Passing a `ProxyAgent` as `dispatcher` to the global `fetch` fails. The
 *   fetch Node ships and a separately loaded undici are different majors, and
 *   the call dies with `invalid onRequestStart` before a byte is sent.
 * - Replacing the global dispatcher (`setGlobalDispatcher`) so one origin can
 *   take a tunnel hands every other request to a dispatcher that does not
 *   decode gzip. Other plugins then fail to parse npm, usage, and search
 *   responses. That is the host's dispatcher to own, through
 *   `@deepseek-ai/dsh-http-proxy` and the standard proxy variables.
 *
 * So when `GROK_PROXY` (or `GROK_API_PROXY`) names an http(s) tunnel and the
 * host does not already proxy the Grok origin, only this plugin's requests use
 * the host undici's own `fetch` bound to a `ProxyAgent`. Everyone else keeps
 * the global fetch. The `grok` CLI gets the same tunnel in its own environment
 * only; a host proxy policy (`proxyEnvironmentForChild`) wins over it.
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const HTTP_PROXY_PATTERN = /^https?:\/\//iu
const HOST_PROXY_PACKAGE = '@deepseek-ai/dsh-http-proxy'
const GROK_ORIGIN = 'https://cli-chat-proxy.grok.com/'

/** One bound fetch per tunnel URL. Never a process-wide dispatcher. */
let cached
/** Tests substitute the undici module and the host-policy answers. */
const dependencies = { undici: undefined, hostProxies: undefined, hostProxyEnv: undefined }

/** Resolve the proxy URL for this plugin's Grok HTTP calls. */
export function apiProxyUrl(env = process.env) {
  const named = [env?.GROK_API_PROXY, env?.GROK_PROXY]
  for (const candidate of named) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return undefined
}

/**
 * The host installation's undici, found by walking up from the running entry
 * point. Its `fetch` and `ProxyAgent` belong together; the global fetch does not.
 * @returns the module namespace, or undefined.
 */
async function loadHostUndici() {
  let dir = dirname(process.argv[1] ?? '')
  for (let depth = 0; depth < 6 && dir && dir !== dirname(dir); depth++) {
    const entry = join(dir, 'node_modules', 'undici', 'index.js')
    if (existsSync(entry)) {
      try {
        return await import(pathToFileURL(entry).href)
      } catch {
        break
      }
    }
    dir = dirname(dir)
  }
  try {
    return await import('undici')
  } catch {
    return undefined
  }
}

async function hostProxyModule() {
  try {
    return await import(HOST_PROXY_PACKAGE)
  } catch {
    return undefined
  }
}

/** Whether the host's own proxy policy already sends the Grok origin through a tunnel. */
async function hostAlreadyProxiesGrok() {
  if (typeof dependencies.hostProxies === 'function') return dependencies.hostProxies()
  const mod = await hostProxyModule()
  try {
    return mod?.proxyRouteFor?.(GROK_ORIGIN)?.proxied === true
  } catch {
    return false
  }
}

/**
 * Environment overlay the host wants spawned children to inherit, when it
 * actually names a proxy. Empty when the host has no proxy policy.
 * @returns the overlay, or undefined.
 */
const CHILD_PROXY_NAMES = ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']

function proxyOverlay(value) {
  if (!value || typeof value !== 'object') return undefined
  return CHILD_PROXY_NAMES.some(name => typeof value[name] === 'string' && value[name].trim())
    ? value
    : undefined
}

export async function hostProxyEnvironment() {
  if (typeof dependencies.hostProxyEnv === 'function') return proxyOverlay(dependencies.hostProxyEnv())
  const mod = await hostProxyModule()
  try {
    const overlay = typeof mod?.proxyEnvironmentForChild === 'function'
      ? mod.proxyEnvironmentForChild()
      : undefined
    return proxyOverlay(overlay)
  } catch {
    return undefined
  }
}

/**
 * Fetch for one Grok request, or undefined to use the global fetch.
 *
 * Undefined is the right answer when no tunnel is configured, the URL is not an
 * http(s) proxy (undici's ProxyAgent speaks CONNECT only; the CLI still accepts
 * SOCKS), the host already routes this origin, or undici cannot be loaded. A
 * caller then keeps the host's dispatcher and its decompression.
 * @param env - environment to read the proxy URL from.
 * @returns a fetch-compatible function bound to the tunnel.
 */
export async function grokFetch(env = process.env) {
  const url = apiProxyUrl(env)
  if (!url || !HTTP_PROXY_PATTERN.test(url)) return undefined
  if (await hostAlreadyProxiesGrok()) return undefined
  if (cached?.url === url) return cached.fetch
  const undici = dependencies.undici ?? await loadHostUndici()
  if (typeof undici?.fetch !== 'function' || typeof undici?.ProxyAgent !== 'function') return undefined
  try {
    const dispatcher = new undici.ProxyAgent(url)
    const fetchImpl = (input, init) => undici.fetch(input, { ...init, dispatcher })
    cached = { url, fetch: fetchImpl }
    return fetchImpl
  } catch {
    return undefined
  }
}

/** Drop the cached fetch (tests, and a proxy URL that changed). */
export function resetGrokFetch() {
  cached = undefined
}

/** Test seam. */
export function setProxyDependencies(next = {}) {
  dependencies.undici = next.undici
  dependencies.hostProxies = next.hostProxies
  dependencies.hostProxyEnv = next.hostProxyEnv
}
