import { CORDIS_ID, DISPLAY_NAME, DISPLAY_NAME_ZH, PROVIDER_ID, SETTINGS_NAMESPACE } from './constants.js'
import { createSessionService } from './session.js'
import { createRpcHandler } from './rpc.js'
import { registerSubscriptionTransport } from './transport.js'
import { createGrokBuildAdapter } from './adapter.js'

export const name = CORDIS_ID
export const inject = ['llm', 'credentials', 'settings', 'web']

export function apply(ctx) {
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
    if (!active) return
    try {
      ctx.emit('llm/adapters-updated')
    } catch (error) {
      ctx.logger?.warn?.('an llm/adapters-updated listener failed')
      ctx.logger?.warn?.(error)
    }
  }

  const session = createSessionService({
    credentials: ctx.credentials,
    logger: ctx.logger,
    onCatalogChange: notifyCatalogChange,
  })
  const handler = createRpcHandler(session)

  void boot(ctx, session, notifyCatalogChange)

  ctx.inject(['connection'], connectionContext => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    'grok-subscription: host-only account RPC',
  ))
}

async function boot(ctx, session, notifyCatalogChange) {
  await tryRegisterSettings(ctx)
  try {
    await session.pull()
  } catch (error) {
    ctx.logger?.debug?.('Grok subscription startup pull skipped: %s', error instanceof Error ? error.message : 'unknown')
  }
  try {
    const created = await createGrokBuildAdapter(session)
    if (created.note) ctx.logger?.warn?.(created.note)
    ctx.llm.registerAdapter([PROVIDER_ID], created.adapter)
    try {
      ctx.llm.registerConfigurableProviders?.([{
        provider: PROVIDER_ID,
        displayName: DISPLAY_NAME,
        settingsNs: SETTINGS_NAMESPACE,
        settingsPath: [],
      }])
    } catch (error) {
      ctx.logger?.debug?.('Grok subscription provider directory skipped: %s', error instanceof Error ? error.message : 'unknown')
    }
    // Ensure Chat / New Session pickers refresh after the adapter is registered
    // (startup pull may have notified before registerAdapter).
    notifyCatalogChange?.()
  } catch (error) {
    ctx.logger?.warn?.('Grok subscription adapter failed to start: %s', error instanceof Error ? error.message : 'unknown')
  }
}

async function tryRegisterSettings(ctx) {
  if (typeof ctx.settings?.register !== 'function') return
  try {
    const mod = await import('@deepseek-ai/schemastery')
    const z = mod.default ?? mod
    ctx.settings.register(SETTINGS_NAMESPACE, z.object({}))
  } catch (error) {
    ctx.logger?.debug?.('Grok subscription settings namespace skipped: %s', error instanceof Error ? error.message : 'unknown')
  }
}

export { PROVIDER_ID, DISPLAY_NAME, DISPLAY_NAME_ZH }
