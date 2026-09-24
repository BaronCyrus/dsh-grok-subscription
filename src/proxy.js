/**
 * Tunnel for this plugin's own Grok traffic.
 *
 * `cli-chat-proxy.grok.com` is not reachable from every network, while the
 * harness itself must keep talking to its other providers directly: a global
 * `http_proxy` would couple every provider to this tunnel and cost the user
 * DeepSeek, packy-code and plugin installation the moment it goes down.
 *
 * The route is therefore installed as a per-origin dispatcher: this plugin's
 * Grok host rides the configured tunnel, every other origin keeps the direct
 * pool. A host that already routes the Grok origin through its own policy (the
 * harness read standard proxy variables) is left untouched.
 *
 * `GROK_PROXY` is the one knob; `GROK_API_PROXY` overrides it for these
 * requests, `GROK_CLI_PROXY` for the spawned CLI.
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Origins this plugin owns: everything else must keep its own route. */
export const GROK_API_HOSTS = Object.freeze(['cli-chat-proxy.grok.com'])

const HTTP_PROXY_PATTERN = /^https?:\/\//iu
/** Package that already holds the host's proxy policy, when it is installed. */
const HOST_PROXY_PACKAGE = '@deepseek-ai/dsh-http-proxy'

/** Installed routing: one per configured tunnel. */
let installed
/** Tests substitute the undici surface and the host-policy probe. */
const dependencies = { undici: undefined, hostProxies: undefined }

/** Resolve the proxy URL for this plugin's Grok HTTP calls. */
export function apiProxyUrl(env = process.env) {
  const named = [env?.GROK_API_PROXY, env?.GROK_PROXY]
  for (const candidate of named) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return undefined
}

function hostOf(origin) {
  try {
    return new URL(origin).hostname
  } catch {
    return ''
  }
}

/**
 * Locate the host installation's undici by walking up from the running entry
 * point — the same peer-resolution walk the plugin uses elsewhere. The copy a
 * plain `import('undici')` finds from a profile can be another installation's
 * (and a different major than the one backing global fetch), so the host's own
 * copy is preferred and the bare specifier is only a fallback.
 * @returns a module namespace, or undefined.
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

/** Whether the harness already sends the Grok origin through a proxy. */
async function hostProxiesGrok() {
  if (typeof dependencies.hostProxies === 'function') return dependencies.hostProxies()
  try {
    const mod = await import(HOST_PROXY_PACKAGE)
    const route = mod?.proxyRouteFor?.(`https://${GROK_API_HOSTS[0]}/`)
    return route?.proxied === true
  } catch {
    return false
  }
}

/**
 * Route the Grok API through the configured tunnel.
 *
 * Idempotent and cached; the routing stays installed for the plugin's lifetime
 * and {@link resetApiRouting} puts the previous dispatcher back.
 * @param env - environment to read the proxy URL from.
 * @returns `'plugin'` when this module installed the route, `'host'` when the
 *   harness already routes it, `'direct'` when no usable tunnel is configured.
 */
export async function ensureApiRouting(env = process.env) {
  const url = apiProxyUrl(env)
  // undici's ProxyAgent speaks HTTP CONNECT only; a SOCKS URL cannot be
  // expressed here, so the request keeps its direct route. The CLI does support
  // SOCKS, which is why `cliProxyEnv` passes it through.
  if (!url || !HTTP_PROXY_PATTERN.test(url)) return 'direct'
  if (installed?.url === url) return 'plugin'
  if (await hostProxiesGrok()) return 'host'
  const undici = dependencies.undici ?? await loadHostUndici()
  const { Agent, Pool, ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = undici ?? {}
  if (typeof Agent !== 'function' || typeof setGlobalDispatcher !== 'function') return 'direct'
  try {
    const tunnel = new ProxyAgent(url)
    const routing = new Agent({
      factory(origin, options) {
        return GROK_API_HOSTS.includes(hostOf(origin)) ? tunnel : new Pool(origin, options)
      },
    })
    const previous = typeof getGlobalDispatcher === 'function' ? getGlobalDispatcher() : undefined
    setGlobalDispatcher(routing)
    installed = {
      url,
      dispatcher: routing,
      restore: () => {
        if (previous !== undefined) setGlobalDispatcher(previous)
        installed = undefined
      },
    }
    return 'plugin'
  } catch {
    // Unusable proxy URL or an undici surface without these classes: the
    // request keeps its direct route and reports its own failure.
    return 'direct'
  }
}

/**
 * Undo the installed route, if this module installed one.
 * @returns the previous dispatcher was restored.
 */
export function resetApiRouting() {
  const current = installed
  installed = undefined
  if (!current) return false
  try {
    current.restore()
    return true
  } catch {
    return false
  }
}

/** Test seam: substitute undici classes or the host-policy probe. */
export function setRoutingDependencies(next = {}) {
  dependencies.undici = next.undici
  dependencies.hostProxies = next.hostProxies
}
