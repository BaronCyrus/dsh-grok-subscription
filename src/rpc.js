import { publicError, publicResult } from './rpc-contract.js'

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
  return next
}

export function createRpcHandler(session) {
  return async function handle(endpoint, _payload, _signal) {
    try {
      if (endpoint === 'status') return publicResult(stripSecrets(await session.status()))
      if (endpoint === 'pull') return publicResult(stripSecrets(await session.pull()))
      if (endpoint === 'logout') return publicResult(stripSecrets(await session.logout()))
      if (endpoint === 'catalog/refresh') {
        const catalog = await session.refreshCatalog()
        return publicResult(stripSecrets({ catalog, account: session.publicAccount() }))
      }
      if (endpoint === 'login/cli') return publicResult(stripSecrets(await session.login({ device: false })))
      if (endpoint === 'login/device') return publicResult(stripSecrets(await session.login({ device: true })))
      return publicError(new Error(`Unknown Grok subscription RPC: ${endpoint}`))
    } catch (error) {
      return publicError(error)
    }
  }
}
