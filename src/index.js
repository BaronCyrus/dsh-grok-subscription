import { CORDIS_ID, DISPLAY_NAME, DISPLAY_NAME_ZH, PROVIDER_ID, SETTINGS_NAMESPACE } from './constants.js'
import { createSessionService } from './session.js'
import { createGrokPluginManager } from './plugin-version.js'
import { createRpcHandler } from './rpc.js'
import { registerSubscriptionTransport } from './transport.js'
import {
  createGrokBuildAdapter,
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
  /**
   * How the `grok-build` route is served: `starting` until the deferred
   * registration lands, `pi-ai` once the host's adapter owns it, and
   * `unavailable` when the host's pi-ai packages could not be resolved.
   * Surfaced to Settings so a capability question ("why can't I attach an
   * image?") is answerable without reading logs.
   */
  const adapterState = { kind: 'starting' }
  const pluginManager = options.pluginManager ?? createGrokPluginManager()
  const handler = createRpcHandler(session, {
    pluginManager,
    diagnostics: () => ({
      adapter: adapterState.kind,
      imageInput: typeof resolveAttachments()?.readImageRequest === 'function',
      hostPeersResolved: adapterState.kind === 'pi-ai',
    }),
  })

  // The host's durable attachment store, resolved lazily because it may register
  // after this plugin and is only consulted when a request carries an image.
  const resolveAttachments = attachmentResolver(ctx)

  // The adapter is built from the host's pi-ai packages, so it is registered
  // from a deferred task rather than inside apply: `apply` must return before
  // the plugin list renders, and a pending dynamic import there is what wedged
  // Settings → Plugins ("Reading plugins…") in earlier releases.
  const defer = options.defer ?? scheduleDeferred
  defer(() => {
    void deferredBoot(ctx, session, notifyCatalogChange, options, adapterState)
  })

  ctx.inject(['connection'], connectionContext => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    'grok-subscription: host-only account RPC',
  ))
}

async function deferredBoot(ctx, session, notifyCatalogChange, options = {}, adapterState) {
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

  if (options.skipAdapter) {
    adapterState.kind = 'unavailable'
    return
  }

  const buildAdapter = options.buildAdapter ?? createGrokBuildAdapter
  try {
    const created = await buildAdapter(session, {
      ...options.adapterOptions,
      resolveAttachments: attachmentResolver(ctx),
    })
    if (!created?.adapter) {
      adapterState.kind = 'unavailable'
      ctx.logger?.warn?.(
        'Grok subscription adapter is unavailable: %s',
        created?.note ?? 'unknown',
      )
      return
    }
    if (created.note) ctx.logger?.warn?.(created.note)
    ctx.llm.registerAdapter([PROVIDER_ID], created.adapter)
    adapterState.kind = created.kind ?? 'pi-ai'
    notifyCatalogChange?.()
  } catch (error) {
    adapterState.kind = 'unavailable'
    ctx.logger?.warn?.(
      'Grok subscription adapter registration failed: %s',
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
  softService,
  scheduleDeferred,
}
