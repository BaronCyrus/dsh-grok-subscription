import { RPC_ENDPOINTS } from './rpc-contract.js'

function parseEnvelope(body, method) {
  if (!body || typeof body !== 'object') return undefined
  if (body.method !== method) return undefined
  return {
    rpcId: body.rpcId,
    payload: body.payload,
  }
}

export function registerSubscriptionTransport(connection, handler) {
  const disposers = []
  try {
    for (const endpoint of RPC_ENDPOINTS) {
      const method = `grok-subscription/${endpoint}`
      if (typeof connection?.fetch?.register !== 'function') {
        throw new Error('DSH connection.fetch.register is unavailable')
      }
      disposers.push(connection.fetch.register({
        path: `/api/${method}`,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
          if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
            return new Response('content type must be application/json', { status: 415 })
          }
          let body
          try {
            body = await request.json()
          } catch {
            return new Response('invalid JSON', { status: 400 })
          }
          const envelope = parseEnvelope(body, method)
          if (!envelope) return new Response('invalid RPC envelope', { status: 400 })
          let result
          try {
            request.signal?.throwIfAborted?.()
            result = await handler(endpoint, envelope.payload, request.signal)
          } catch {
            result = { ok: false, error: { code: 'internal', message: 'Grok subscription request failed', details: { issues: [] } } }
          }
          return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result })
        },
      }))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose?.()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose?.()
  }
}
