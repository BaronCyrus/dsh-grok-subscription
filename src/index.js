import { CORDIS_ID, DISPLAY_NAME, DISPLAY_NAME_ZH, PROVIDER_ID, SETTINGS_NAMESPACE } from './constants.js'
import { createSessionService } from './session.js'
import { createGrokPluginManager } from './plugin-version.js'
import { createRpcHandler } from './rpc.js'
import { registerSubscriptionTransport } from './transport.js'
import {
  createGrokBuildAdapter,
  createGrokBuildAdapterSync,
  optionalImport,
} from './adapter.js'
export const name = CORDIS_ID
/**
 * Keep inject narrow so sticky credentials/settings cannot delay plugin apply
 * (Settings → Plugins "Reading plugins…"). Soft-get the rest via ctx.get only.
 */
export const inject = ['llm', 'web']

function scheduleDeferred(run) {
  if (typeof setImmediate === 'function') setImmediate(run)
  else queueMicrotask(run)
}

function softService(ctx, key) {
  // Never touch ctx[key]: Cordis throws "cannot get property X without inject"
  // when the service is not listed in `inject`.
  try {
    if (typeof ctx.get === 'function') return ctx.get(key) ?? undefined
  } catch {
    // Cordis get may throw when the service is absent; soft-fail.
  }
  return undefined
}

/**
 * Claim this plugin's provider route and return the host's release handle.
 *
 * `ctx.llm.registerAdapter` refuses a second adapter for a provider that
 * already has one (`DUPLICATE_ADAPTER`, all-or-nothing) in every release this
 * plugin supports, so the route must be released before the pi-ai upgrade can
 * take it over.
 */
function registerProviderAdapter(ctx, adapter) {
  const handle = ctx.llm.registerAdapter([PROVIDER_ID], adapter)
  return typeof handle === 'function' ? handle : undefined
}

/**
 * Hand the route from the synchronously registered bundled adapter to the
 * host's official pi-ai adapter.
 *
 * Release and re-register in one synchronous step, so no request can observe
 * the route unserved, and restore the bundled adapter if the host refuses the
 * replacement: a Settings page that says "bundled fallback" is honest, a
 * provider route that streams nothing is not.
 *
 * @param ctx - plugin scope owning both registrations.
 * @param adapter - the prepared pi-ai adapter.
 * @param registration - mutable holder of the live adapter and its release handle.
 */
function upgradeProviderAdapter(ctx, adapter, registration) {
  const previous = registration.adapter
  registration.release?.()
  registration.release = undefined
  registration.adapter = undefined
  try {
    registration.release = registerProviderAdapter(ctx, adapter)
    registration.adapter = adapter
  } catch (error) {
    if (previous !== undefined) {
      try {
        registration.release = registerProviderAdapter(ctx, previous)
        registration.adapter = previous
      } catch {
        registration.release = undefined
      }
    }
    throw error
  }
}

/**
 * Documented rollback: `DSH_GROK_ADAPTER=fallback` keeps the bundled adapter
 * even where the host's official one is available, so a host adapter that
 * misbehaves in real use can be switched off without waiting for a release.
 * Set it in DSH's own environment (`~/.dsh/.env`), not the project's.
 */
export function adapterOverride(env = process.env) {
  const value = typeof env?.DSH_GROK_ADAPTER === 'string'
    ? env.DSH_GROK_ADAPTER.trim().toLowerCase()
    : ''
  return value === 'fallback' ? 'fallback' : undefined
}

/**
 * Lazily resolve the host's durable attachment store. It may register after
 * this plugin, and it is only consulted when a request carries an image.
 */
function attachmentResolver(ctx) {
  return () => {
    try {
      return typeof ctx.get === 'function' ? ctx.get('attachments') : undefined
    } catch {
      return undefined
    }
  }
}

export function apply(ctx, options = {}) {
  let active = true
  if (typeof ctx.effect === 'function') {
    ctx.effect(
      () => () => {
        active = false
      },
      'grok-subscription: startup lifetime',
    )
  }

  const notifyCatalogChange = () => {
    // Always defer: sync emit during apply/plugin load can re-enter listeners
    // while the loader is still spinning (Settings → Plugins "Reading…").
    scheduleDeferred(() => {
      if (!active) return
      try {
        ctx.emit('llm/adapters-updated')
      } catch (error) {
        ctx.logger?.warn?.('an llm/adapters-updated listener failed')
        ctx.logger?.warn?.(error)
      }
    })
  }

  const credentials = softService(ctx, 'credentials')
  const session = createSessionService({
    credentials,
    logger: ctx.logger,
    onCatalogChange: notifyCatalogChange,
  })
  // Which adapter is live: the sync fallback until the deferred upgrade swaps in
  // the host's official pi-ai implementation. Surfaced to Settings so a
  // capability question ("why can't I attach an image?") is answerable without
  // reading logs.
  const adapterState = { kind: 'custom-mvp', upgraded: false }
  const pluginManager = options.pluginManager ?? createGrokPluginManager()
  const handler = createRpcHandler(session, {
    pluginManager,
    diagnostics: () => ({
      adapter: adapterState.upgraded ? 'pi-ai' : 'fallback',
      adapterKind: adapterState.kind,
      imageInput: typeof resolveAttachments()?.readImageRequest === 'function',
      hostPeersResolved: adapterState.upgraded,
    }),
  })

  // The host's durable attachment store, resolved lazily because it may register
  // after this plugin and is only consulted when a request carries an image.
  const resolveAttachments = attachmentResolver(ctx)

  const createSync = options.createSync ?? createGrokBuildAdapterSync
  /** The adapter serving the route now, and the handle that releases it. */
  const registration = { adapter: undefined, release: undefined }
  // Register a duck host adapter synchronously so apply returns immediately
  // and the plugin list / Settings RPC are never blocked on pi-ai imports.
  try {
    const created = createSync(session, { resolveAttachments })
    if (created.note) ctx.logger?.debug?.(created.note)
    adapterState.kind = created.kind
    registration.adapter = created.adapter
    registration.release = registerProviderAdapter(ctx, created.adapter)
    // Catalog notify deferred so pickers refresh without re-entering apply.
    notifyCatalogChange()
  } catch (error) {
    ctx.logger?.warn?.(
      'Grok subscription duck adapter failed to register: %s',
      error instanceof Error ? error.message : 'unknown',
    )
  }

  const defer = options.defer ?? scheduleDeferred
  const deferredOptions = adapterOverride() === 'fallback'
    ? { ...options, skipUpgrade: true }
    : options
  defer(() => {
    void deferredBoot(ctx, session, notifyCatalogChange, deferredOptions, adapterState, registration)
  })

  ctx.inject(['connection'], connectionContext => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    'grok-subscription: host-only account RPC',
  ))
}

async function deferredBoot(ctx, session, notifyCatalogChange, options = {}, adapterState, registration) {
  if (!options.skipSettings) {
    await tryRegisterSettings(ctx)
  }

  try {
    ctx.llm.registerConfigurableProviders?.([{
      provider: PROVIDER_ID,
      displayName: DISPLAY_NAME,
      settingsNs: SETTINGS_NAMESPACE,
      settingsPath: [],
    }])
  } catch (error) {
    ctx.logger?.debug?.(
      'Grok subscription provider directory skipped: %s',
      error instanceof Error ? error.message : 'unknown',
    )
  }

  // Kick Pull without awaiting — memory-first path returns quickly; never block boot.
  if (!options.skipPull) {
    void session.pull().catch(error => {
      ctx.logger?.debug?.(
        'Grok subscription startup pull skipped: %s',
        error instanceof Error ? error.message : 'unknown',
      )
    })
  }

  if (options.skipUpgrade) return

  const createAsync = options.createAsync ?? createGrokBuildAdapter
  try {
    const created = await createAsync(session, { ...options.adapterOptions, resolveAttachments: attachmentResolver(ctx) })
    if (created.kind === 'pi-ai') {
      if (created.note) ctx.logger?.warn?.(created.note)
      // The bundled adapter already owns the route: hand it over instead of
      // re-registering, which the host refuses with DUPLICATE_ADAPTER.
      if (registration) upgradeProviderAdapter(ctx, created.adapter, registration)
      else ctx.llm.registerAdapter([PROVIDER_ID], created.adapter)
      if (adapterState) {
        adapterState.kind = created.kind
        adapterState.upgraded = true
      }
      notifyCatalogChange?.()
    } else if (created.note) {
      ctx.logger?.debug?.(created.note)
    }
  } catch (error) {
    ctx.logger?.warn?.(
      'Grok subscription adapter upgrade failed: %s',
      error instanceof Error ? error.message : 'unknown',
    )
  }
}

async function tryRegisterSettings(ctx) {
  const settings = softService(ctx, 'settings')
  if (typeof settings?.register !== 'function') return
  try {
    const mod = await optionalImport('@deepseek-ai/schemastery')
    if (!mod) {
      ctx.logger?.debug?.('Grok subscription settings namespace skipped: schemastery unavailable or timed out')
      return
    }
    const z = mod.default ?? mod
    settings.register(SETTINGS_NAMESPACE, z.object({}))
  } catch (error) {
    ctx.logger?.debug?.(
      'Grok subscription settings namespace skipped: %s',
      error instanceof Error ? error.message : 'unknown',
    )
  }
}

export {
  PROVIDER_ID,
  DISPLAY_NAME,
  DISPLAY_NAME_ZH,
  deferredBoot,
  registerProviderAdapter,
  softService,
  scheduleDeferred,
  upgradeProviderAdapter,
}
