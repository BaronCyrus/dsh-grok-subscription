export const CHANNEL = '/grok-subscription'
export const RPC_ENDPOINTS = Object.freeze([
  'status',
  'login/cli',
  'login/device',
  'pull',
  'logout',
  'catalog/refresh',
])

export function createRpcClient(transport) {
  return Object.freeze({
    call(channel, endpoint, payload, signal) {
      if (channel !== CHANNEL || !RPC_ENDPOINTS.includes(endpoint)) {
        throw new Error('Invalid Grok subscription RPC target')
      }
      return transport.call('/api', `grok-subscription/${endpoint}`, payload, signal)
    },
  })
}

export function unwrap(response) {
  if (!response?.ok) throw new Error(response?.error?.message ?? 'Grok subscription RPC failed')
  return response.value
}

export function publicResult(value) {
  return { ok: true, value }
}

export function publicError(error, fallback = 'Grok subscription request failed') {
  const message = error instanceof Error ? error.message : fallback
  return { ok: false, error: { code: 'internal', message, details: { issues: [] } } }
}
