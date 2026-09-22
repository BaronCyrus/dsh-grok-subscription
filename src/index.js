import { CORDIS_ID, DISPLAY_NAME, DISPLAY_NAME_ZH, PROVIDER_ID, SETTINGS_NAMESPACE } from './constants.js'
import { createSessionService } from './session.js'
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
  const handler = createRpcHandler(session)

  const createSync = options.createSync ?? createGrokBuildAdapterSync
  // Register a duck host adapter synchronously so apply returns immediately
  // and the plugin list / Settings RPC are never blocked on pi-ai imports.
  try {
    const created = createSync(session)
    if (created.note) ctx.logger?.debug?.(created.note)
    ctx.llm.registerAdapter([PROVIDER_ID], created.adapter)
    // Catalog notify deferred so pickers refresh without re-entering apply.
    notifyCatalogChange()
  } catch (error) {
    ctx.logger?.warn?.(
      'Grok subscription duck adapter failed to register: %s',
      error instanceof Error ? error.message : 'unknown',
    )
  }

  const defer = options.defer ?? scheduleDeferred
  defer(() => {
    void deferredBoot(ctx, session, notifyCatalogChange, options)
  })

  ctx.inject(['connection'], connectionContext => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    'grok-subscription: host-only account RPC',
  ))
}

async function deferredBoot(ctx, session, notifyCatalogChange, options = {}) {
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
  // Resolved lazily: the attachment service may register after this plugin, and
  // it is only consulted when a request actually carries an image.
  const resolveAttachments = () => {
    try {
      return typeof ctx.get === 'function' ? ctx.get('attachments') : undefined
    } catch {
      return undefined
    }
  }
  try {
    const created = await createAsync(session, { ...options.adapterOptions, resolveAttachments })
    if (created.kind === 'pi-ai') {
      if (created.note) ctx.logger?.warn?.(created.note)
      ctx.llm.registerAdapter([PROVIDER_ID], created.adapter)
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

export { PROVIDER_ID, DISPLAY_NAME, DISPLAY_NAME_ZH, deferredBoot, softService, scheduleDeferred }
