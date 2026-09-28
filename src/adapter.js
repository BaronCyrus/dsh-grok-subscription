import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  DISPLAY_NAME,
  IMPORT_TIMEOUT_MS,
  MAX_REQUEST_IMAGE_BYTES,
  PROVIDER_ID,
  PROXY_BASE_URL,
  REQUEST_IMAGE_MAX_BYTES,
  REQUEST_IMAGE_PIXEL_BUDGET,
  STREAM_IDLE_TIMEOUT_MS,
} from './constants.js'
import { toPiModels } from './catalog.js'
import { fingerprintHeaders } from './headers.js'

function withImportTimeout(promise, ms, message) {
  let timer
  // Keep the timer ref'd: an unref'd timeout can let the event loop drain before
  // the race settles (and would leave optionalImport hanging in idle hosts/tests).
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * Directories the host keeps its own dependencies in.
 *
 * The host owns `@earendil-works/pi-ai` and the DSH packages — the plugin only
 * declares an optional peer relationship with them. Node resolves bare
 * specifiers from this file's real path, which usually sits outside the host
 * install, so a plain `import()` fails and the plugin silently degrades to its
 * custom adapter. These roots give it a second chance.
 */
export function hostModuleRoots(env = process.env, argv1 = process.argv[1]) {
  const roots = []
  const push = dir => {
    if (typeof dir === 'string' && dir && !roots.includes(dir)) roots.push(dir)
  }
  const override = env.DSH_GROK_PEER_ROOT
  if (typeof override === 'string' && override.trim()) push(override.trim())
  // Walk up from the running entry point (…/@deepseek-ai/dsh/lib/bin.js and
  // friends), which also covers npx-style caches.
  if (typeof argv1 === 'string' && argv1) {
    let dir = dirname(argv1)
    for (let depth = 0; depth < 6 && dir && dir !== dirname(dir); depth++) {
      push(join(dir, 'node_modules'))
      dir = dirname(dir)
    }
  }
  const prefix = env.NPM_CONFIG_PREFIX
  if (typeof prefix === 'string' && prefix.trim()) push(join(prefix.trim(), 'lib', 'node_modules'))
  // The Node that runs the host also locates a global npm tree: Homebrew
  // (/opt/homebrew/lib/node_modules), Intel Homebrew and distro packages
  // (/usr/local/lib/node_modules), and nvm (~/.nvm/versions/node/vX/lib/node_modules).
  if (typeof process.execPath === 'string' && process.execPath) {
    push(join(dirname(process.execPath), '..', 'lib', 'node_modules'))
  }
  push(join('/opt/homebrew', 'lib', 'node_modules'))
  push(join('/usr/local', 'lib', 'node_modules'))
  for (const segment of ['Library/pnpm', '.local/share/pnpm', '.pnpm-global']) {
    push(join(homedir(), segment, 'node_modules'))
  }
  // Portable/bundled distributions that keep the harness beside the app data.
  if (typeof env.DSH_PORTABLE_HOME === 'string' && env.DSH_PORTABLE_HOME.trim()) {
    push(join(env.DSH_PORTABLE_HOME.trim(), 'node_modules'))
  }
  push(join(homedir(), '.local', 'lib', 'node_modules'))
  const dshHome = typeof env.DSH_HOME === 'string' && env.DSH_HOME.trim()
    ? env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  push(join(dshHome, 'profiles', 'node_modules'))
  return roots
}

function splitSpecifier(specifier) {
  const parts = specifier.split('/')
  const take = specifier.startsWith('@') ? 2 : 1
  return {
    name: parts.slice(0, take).join('/'),
    subpath: parts.length > take ? `./${parts.slice(take).join('/')}` : '.',
  }
}

/** Pick the ESM entry out of an exports target (string or conditions object). */
function pickExportTarget(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return undefined
  for (const condition of ['import', 'module', 'default', 'node']) {
    if (condition in value) {
      const picked = pickExportTarget(value[condition])
      if (picked) return picked
    }
  }
  return undefined
}

function resolveExportsTarget(exportsField, subpath) {
  if (typeof exportsField === 'string') return subpath === '.' ? exportsField : undefined
  if (!exportsField || typeof exportsField !== 'object') return undefined
  const keys = Object.keys(exportsField)
  const isSubpathMap = keys.some(key => key === '.' || key.startsWith('./'))
  if (!isSubpathMap) return subpath === '.' ? pickExportTarget(exportsField) : undefined
  if (subpath in exportsField) return pickExportTarget(exportsField[subpath])
  for (const key of keys) {
    const star = key.indexOf('*')
    if (star === -1) continue
    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue
    const matched = subpath.slice(prefix.length, subpath.length - suffix.length)
    const target = pickExportTarget(exportsField[key])
    if (target) return target.replace('*', matched)
  }
  return undefined
}

/**
 * Resolve one specifier under one root by reading the package manifest.
 *
 * Needed because `require.resolve` only honours the `require`/`default`
 * conditions — `@earendil-works/pi-ai` exports exactly `{ types, import }`, so
 * every CommonJS-based lookup reports ERR_PACKAGE_PATH_NOT_EXPORTED even though
 * the package is present. Node's own 2-argument `import.meta.resolve` would
 * apply the `import` condition but still requires
 * `--experimental-import-meta-resolve` on Node 22, which the host does not set.
 */
function resolveHostSpecifierManually(root, specifier) {
  const { name, subpath } = splitSpecifier(specifier)
  // Roots are normally `node_modules` directories, but an override may point at
  // a project root. A globally installed DSH also nests its own dependencies
  // under `@deepseek-ai/dsh/node_modules`, so look there too.
  const candidates = [
    join(root, name),
    join(root, 'node_modules', name),
    join(root, '@deepseek-ai', 'dsh', 'node_modules', name),
    join(root, 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', name),
  ]
  for (const pkgDir of candidates) {
    const manifest = join(pkgDir, 'package.json')
    if (!existsSync(manifest)) continue
    let pkg
    try {
      pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    } catch {
      continue
    }
    const target = pkg.exports !== undefined
      ? resolveExportsTarget(pkg.exports, subpath)
      : (subpath === '.' ? pkg.module ?? pkg.main ?? 'index.js' : undefined)
    if (typeof target !== 'string' || !target) continue
    const file = join(pkgDir, target)
    if (existsSync(file)) return file
  }
  return undefined
}

/**
 * Resolve a bare specifier against the host roots. The peers are ESM-only, so
 * this yields the very files the host itself loads — sharing module instances
 * instead of duplicating them.
 */
export function resolveHostSpecifier(specifier, roots = hostModuleRoots()) {
  for (const root of roots) {
    try {
      const resolved = createRequire(join(root, 'noop.js')).resolve(specifier)
      if (typeof resolved === 'string' && resolved) return resolved
    } catch {
      // Export conditions may exclude "require"; fall back to the manifest.
    }
    const manual = resolveHostSpecifierManually(root, specifier)
    if (manual) return manual
  }
  return undefined
}

/**
 * Dynamic import with a hard timeout. Hanging module graphs (pi-ai / peer
 * packages) must not wedge plugin apply / Settings RPC.
 */
export async function optionalImport(specifier, options = {}) {
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : IMPORT_TIMEOUT_MS
  const injected = typeof options.importFn === 'function' ? options.importFn : undefined
  const importFn = injected ?? (id => import(id))
  const candidates = [specifier]
  if (!injected && !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:')) {
    const resolved = resolveHostSpecifier(specifier, options.hostRoots ?? hostModuleRoots())
    if (resolved) candidates.push(pathToFileURL(resolved).href)
  }
  for (const candidate of candidates) {
    try {
      return await withImportTimeout(
        Promise.resolve(importFn(candidate)),
        timeoutMs,
        `Import timed out after ${timeoutMs}ms: ${specifier}`,
      )
    } catch {
      // Fall through to the next candidate.
    }
  }
  return undefined
}

const PROMPT_CACHE_KEY_MAX_LENGTH = 64
/**
 * The `prompt_cache_key` the plugin pins on the host's pi-ai path.
 *
 * xAI routes a Responses conversation by this key, so it must stay stable for
 * the whole DSH session, including every tool step. pi-ai derives its own key
 * from the session id; pinning the same value here keeps an in-flight
 * conversation's cache warm if the adapter wiring ever changes, and keeps the
 * documented "one session, one key" promise independent of pi-ai's default.
 *
 * The `purpose` suffix is unreachable on this path — `dsh-llm-pi-ai` forwards
 * only `sessionId` into pi-ai, so compaction and session-title calls carry no
 * purpose marker and share the session key. Isolating them was measured
 * against the live proxy and did not improve the chat prefix's cache reads, so
 * the shared key is deliberate. `promptCacheKey` still accepts a purpose so the
 * helper stays a faithful description of the key format.
 */
export function promptCacheKey(options) {
  const sessionId = typeof options?.sessionId === 'string' ? options.sessionId.trim() : ''
  if (!sessionId) return undefined
  const suffix = options.purpose === 'compaction' || options.purpose === 'session-title'
    ? `:${options.purpose}`
    : ''
  const key = `grok${suffix}:${sessionId}`
  return key.length <= PROMPT_CACHE_KEY_MAX_LENGTH ? key : key.slice(0, PROMPT_CACHE_KEY_MAX_LENGTH)
}


/**
 * Models exposed to PiAiAdapter.listModels via provider.getModels().
 * Fail-closed when the subscription session is not signed in.
 * Always stamps provider id as grok-build so the harness route matches.
 */
export function visiblePiModels(session) {
  if (session.publicAccount()?.signedIn !== true) return []
  return toPiModels(session.models()).map(model => (
    model.provider === PROVIDER_ID ? model : { ...model, provider: PROVIDER_ID }
  ))
}


function createStore(session) {
  return {
    async read(providerId) {
      if (providerId !== PROVIDER_ID) return undefined
      const token = await session.currentToken()
      return token ? { type: 'api_key', key: token } : undefined
    },
    async list() {
      const token = await session.currentToken()
      return token ? [{ providerId: PROVIDER_ID, type: 'api_key' }] : []
    },
    async modify(providerId, update) {
      if (providerId !== PROVIDER_ID) return undefined
      const current = await this.read(providerId)
      return update(current)
    },
    async delete(providerId) {
      if (providerId === PROVIDER_ID) await session.logout()
    },
  }
}

function buildAuthConfig() {
  return {
    apiKey: {
      name: 'Grok Build subscription token',
      async resolve({ credential }) {
        const key = credential?.type === 'api_key' ? credential.key : undefined
        if (typeof key !== 'string' || key.length === 0) return undefined
        return { auth: { apiKey: key, headers: fingerprintHeaders() }, source: 'Grok Build subscription' }
      },
    },
  }
}


/**
 * Pin the request semantics this plugin owns on the pi-ai path.
 *
 * pi-ai assembles the Responses `params` itself and then assigns
 * `options.samplingParams` over the result — the last step of `buildParams` in
 * `@earendil-works/pi-ai/dist/api/openai-responses.js` — so this wrapper is the
 * one seam where the plugin can state two fields without forking pi-ai:
 *
 * - `include`: pi-ai hard-codes `reasoning.encrypted_content` for its own `xai`
 *   provider id only, and this route is `grok-build`, so without it multi-turn
 *   assistant text vanishes.
 * - `prompt_cache_key`: the bundled adapter namespaces the key as
 *   `grok:<sessionId>`. Pinning the same value keeps a conversation's cache
 *   warm across the upgrade to this adapter, and keeps the documented "one DSH
 *   session, one stable key" promise independent of pi-ai's own default.
 *
 * A profile that disables caching (`cacheRetention: 'none'`) keeps pi-ai's
 * decision: the plugin never switches back on a cache the host turned off.
 */
function withGrokRequestSemantics(api) {
  const inject = options => {
    const cacheKey = options?.cacheRetention === 'none' ? undefined : promptCacheKey(options)
    return {
      ...options,
      samplingParams: {
        ...options?.samplingParams,
        include: ['reasoning.encrypted_content'],
        ...(cacheKey === undefined ? {} : { prompt_cache_key: cacheKey }),
      },
    }
  }
  return {
    stream: (model, context, options) => api.stream(model, context, inject(options)),
    streamSimple: (model, context, options) => api.streamSimple(model, context, inject(options)),
  }
}

export async function createGrokBuildAdapter(session, options = {}) {
  const importOpts = options.importOptions ?? {}
  const [piAi, dshPi, dshLlm] = await Promise.all([
    optionalImport('@earendil-works/pi-ai', importOpts),
    optionalImport('@deepseek-ai/dsh-llm-pi-ai', importOpts),
    optionalImport('@deepseek-ai/dsh-llm', importOpts),
  ])

  // This plugin has exactly one adapter path: the host's own. Every DSH install
  // carries it (`@deepseek-ai/dsh` → `dsh-base` → `dsh-llm-pi-ai` → pi-ai, with
  // the `llm-pi-ai` row mounted unconditionally), so a missing peer means a
  // broken or unusual install rather than a host this plugin should work around.
  // Report it and register nothing: a half-working substitute would hide the
  // real problem behind subtler symptoms.
  if (!piAi?.createProvider || !dshPi?.PiAiAdapter) {
    return {
      adapter: undefined,
      kind: 'unavailable',
      note: 'the host pi-ai adapter is unavailable: @earendil-works/pi-ai and @deepseek-ai/dsh-llm-pi-ai must be resolvable from the DSH install',
    }
  }

  let responsesApi
  try {
    const lazy = await optionalImport('@earendil-works/pi-ai/api/openai-responses.lazy', importOpts)
    responsesApi = typeof lazy?.openAIResponsesApi === 'function' ? lazy.openAIResponsesApi() : undefined
  } catch {
    responsesApi = undefined
  }
  if (!responsesApi) {
    return {
      adapter: undefined,
      kind: 'unavailable',
      note: 'the pi-ai openai-responses API module is unavailable in this host',
    }
  }
  // pi-ai only auto-sets include for provider id "xai"; grok-build needs the same
  // encrypted reasoning replay so turn 2+ keeps visible assistant text.
  responsesApi = withGrokRequestSemantics(responsesApi)

  const store = createStore(session)
  const authModels = piAi.createModels({
    credentials: store,
    authContext: {
      env: async () => undefined,
      fileExists: async () => false,
    },
  })

  // Credential-resolution provider only. The picker reads getModels from the
  // profile provider rebuilt on every profiles() call (see below).
  const authProvider = piAi.createProvider({
    id: PROVIDER_ID,
    name: DISPLAY_NAME,
    baseUrl: PROXY_BASE_URL,
    headers: fingerprintHeaders(),
    auth: buildAuthConfig(),
    models: [],
    api: { 'openai-responses': responsesApi },
  })
  authModels.setProvider(authProvider)

  const buildLiveProvider = () => {
    const base = piAi.createProvider({
      id: PROVIDER_ID,
      name: DISPLAY_NAME,
      baseUrl: PROXY_BASE_URL,
      headers: fingerprintHeaders(),
      auth: buildAuthConfig(),
      // Snapshot for createProvider internals; PiAiAdapter.listModels uses getModels().
      models: visiblePiModels(session),
      fetchModels: async context => {
        if (!context.allowNetwork) return visiblePiModels(session)
        const token = context.credential?.type === 'api_key' ? context.credential.key : await session.currentToken()
        if (!token || session.publicAccount()?.signedIn !== true) return []
        const catalog = await session.refreshCatalog()
        return toPiModels(catalog.models).map(model => (
          model.provider === PROVIDER_ID ? model : { ...model, provider: PROVIDER_ID }
        ))
      },
      api: { 'openai-responses': responsesApi },
    })
    return {
      ...base,
      // Critical: listModels reads getModels(), not fetchModels / frozen models[].
      getModels: () => visiblePiModels(session),
    }
  }

  const buildProfile = () => Object.freeze({
    provider: PROVIDER_ID,
    displayName: DISPLAY_NAME,
    piProvider: buildLiveProvider(),
    configuredMaxTokens: new Map(),
    modelErrors: new Map(),
    streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS,
    maxRequestImageBytes: MAX_REQUEST_IMAGE_BYTES,
    requestImagePixelBudget: REQUEST_IMAGE_PIXEL_BUDGET,
    requestImageMaxBytes: REQUEST_IMAGE_MAX_BYTES,
    cacheRetention: 'short',
    transport: 'sse',
    reasoning: 'high',
  })

  const LlmError = dshLlm?.LlmError
  const adapter = new dshPi.PiAiAdapter({
    // Rebuild provider each call so getModels() sees post-pull session.models().
    profiles: () => new Map([[PROVIDER_ID, buildProfile()]]),
    resolveApiKey: async () => {
      const token = await session.currentToken()
      if (!token) {
        if (LlmError) throw new LlmError('Grok subscription is not signed in', 'MISSING_CREDENTIAL')
        throw new Error('Grok subscription is not signed in')
      }
      return token
    },
    auth: Object.freeze({
      credentials: store,
      authContext: Object.freeze({
        env: async () => undefined,
        fileExists: async () => false,
      }),
    }),
    // The host's durable attachment store. Without it PiAiAdapter rejects any
    // request carrying an image ("requires the durable attachment service"),
    // and with it images are normalized to the configured budget for us.
    resolveAttachments: typeof options.resolveAttachments === 'function'
      ? () => options.resolveAttachments()
      : undefined,
  })

  return {
    adapter,
    kind: 'pi-ai',
    note: undefined,
    provider: buildLiveProvider(),
    refresh: () => authModels.refresh({ allowNetwork: true, force: true }),
  }
}

export { withGrokRequestSemantics }
