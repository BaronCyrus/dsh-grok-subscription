import { RPC_HANDLER_TIMEOUT_MS } from './constants.js'
import { publicError, publicResult } from './rpc-contract.js'
import { withTimeout } from './session.js'

function stripSecrets(value) {
  if (!value || typeof value !== 'object') return value
  const next = { ...value }
  delete next.accessToken
  delete next.token
  delete next.refresh
  delete next.refresh_token
  delete next.key
  if (next.catalog) {
    next.catalog = {
      source: next.catalog.source,
      error: next.catalog.error,
      models: Array.isArray(next.catalog.models)
        ? next.catalog.models.map(model => ({
          id: model.id,
          name: model.name,
          contextWindow: model.contextWindow,
          reasoning: model.reasoning,
          source: model.source,
        }))
        : [],
    }
  }
  if (next.account) {
    next.account = {
      signedIn: next.account.signedIn === true,
      maskedAccount: next.account.maskedAccount,
      authMode: next.account.authMode,
      expiresAt: next.account.expiresAt,
      source: next.account.source,
    }
  }
  if (next.usage) {
    next.usage = sanitizeUsage(next.usage)
  }
  return next
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return { status: 'unavailable', reason: 'Usage unavailable', experimental: true, source: 'billing-credits-undocumented' }
  }
  const out = {
    status: usage.status === 'ok' ? 'ok' : 'unavailable',
    experimental: true,
    source: typeof usage.source === 'string' ? usage.source : 'billing-credits-undocumented',
  }
  if (out.status !== 'ok') {
    out.reason = typeof usage.reason === 'string' ? usage.reason : 'Usage unavailable'
    return out
  }
  if (typeof usage.usedPercent === 'number' && Number.isFinite(usage.usedPercent)) out.usedPercent = usage.usedPercent
  if (typeof usage.remainingPercent === 'number' && Number.isFinite(usage.remainingPercent)) out.remainingPercent = usage.remainingPercent
  if (typeof usage.periodStart === 'string') out.periodStart = usage.periodStart
  if (typeof usage.periodStartLocal === 'string') out.periodStartLocal = usage.periodStartLocal
  if (typeof usage.periodEnd === 'string') out.periodEnd = usage.periodEnd
  if (typeof usage.periodEndLocal === 'string') out.periodEndLocal = usage.periodEndLocal
  if (typeof usage.fetchedAt === 'string') out.fetchedAt = usage.fetchedAt
  if (Array.isArray(usage.productUsage)) {
    out.productUsage = usage.productUsage
      .filter(row => row && typeof row === 'object')
      .map(row => ({
        ...(typeof row.name === 'string' ? { name: row.name } : {}),
        ...(typeof row.usedPercent === 'number' && Number.isFinite(row.usedPercent) ? { usedPercent: row.usedPercent } : {}),
      }))
  }
  return out
}

function publicPluginVersion(value) {
  const installKind = value?.install?.kind
  return {
    current: value.current,
    latest: value.latest,
    updateAvailable: value.updateAvailable === true,
    install: {
      kind: installKind === 'npm' || installKind === 'link' ? installKind : 'unknown',
    },
  }
}

async function dispatch(session, endpoint, diagnostics, payload, signal, pluginManager) {
  if (endpoint === 'status') {
    const status = await session.status()
    return publicResult(stripSecrets({
      ...status,
      // Which adapter is actually serving this route: the host's official
      // pi-ai implementation or the bundled fallback. Diagnosing "model does
      // not support images" starts here.
      diagnostics: typeof diagnostics === 'function' ? diagnostics() : diagnostics,
    }))
  }
  if (endpoint === 'pull') return publicResult(stripSecrets(await session.pull()))
  if (endpoint === 'logout') return publicResult(stripSecrets(await session.logout()))
  if (endpoint === 'catalog/refresh') {
    const catalog = await session.refreshCatalog()
    return publicResult(stripSecrets({ catalog, account: session.publicAccount(), usage: session.usage?.() }))
  }
  if (endpoint === 'usage') {
    return publicResult(stripSecrets({ usage: session.usage?.() ?? { status: 'unavailable', reason: 'Usage unavailable', experimental: true } }))
  }
  if (endpoint === 'usage/refresh') {
    const usage = await session.refreshUsage()
    return publicResult(stripSecrets({ usage, account: session.publicAccount() }))
  }
  if (endpoint === 'login/cli') return publicResult(stripSecrets(await session.login({ device: false })))
  if (endpoint === 'login/device') return publicResult(stripSecrets(await session.login({ device: true })))
  if (endpoint === 'plugin/version' || endpoint === 'plugin/update') {
    if (!pluginManager) return publicError(new Error('Grok plugin update is unavailable'))
    if (endpoint === 'plugin/version') {
      return publicResult(publicPluginVersion(await pluginManager.read({
        force: payload?.force === true,
        signal,
      })))
    }
    const updated = await pluginManager.update({ signal })
    return publicResult({ version: updated.version })
  }
  return publicError(new Error(`Unknown Grok subscription RPC: ${endpoint}`))
}

export function createRpcHandler(session, options = {}) {
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : RPC_HANDLER_TIMEOUT_MS
  return async function handle(endpoint, payload, signal) {
    try {
      const operation = dispatch(session, endpoint, options.diagnostics, payload, signal, options.pluginManager)
      // Registry installs can take longer than an account RPC. The plugin
      // manager owns that bounded timeout, so wrapping it here would cancel a
      // healthy install.
      if (endpoint === 'plugin/update') return await operation
      return await withTimeout(
        operation,
        timeoutMs,
        `Grok subscription RPC "${endpoint}" timed out after ${timeoutMs}ms`,
        { unref: false },
      )
    } catch (error) {
      return publicError(error)
    }
  }
}
