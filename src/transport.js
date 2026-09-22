import { RPC_ENDPOINTS } from './rpc-contract.js'
import { optionalImport } from './adapter.js'

function parseEnvelope(body, method) {
  if (!body || typeof body !== 'object') return undefined
  if (body.method !== method) return undefined
  return {
    rpcId: body.rpcId,
    payload: body.payload,
  }
}

let cachedClientRequestSchema
let schemaLoadStarted = false

function kickSchemaLoad() {
  if (schemaLoadStarted) return
  schemaLoadStarted = true
  void optionalImport('@deepseek-ai/dsh-client-connection').then(mod => {
    if (mod?.clientRequestSchema && typeof mod.clientRequestSchema.safeParse === 'function') {
      cachedClientRequestSchema = mod.clientRequestSchema
    }
  }).catch(() => {
    // Fall back to parseEnvelope forever.
  })
}

function resolveEnvelope(body, method) {
  const schema = cachedClientRequestSchema
  if (schema) {
    const envelope = schema.safeParse(body)
    if (!envelope.success || envelope.data.method !== method) return undefined
    return { rpcId: envelope.data.rpcId, payload: envelope.data.payload }
  }
  return parseEnvelope(body, method)
}

export function registerSubscriptionTransport(connection, handler) {
  kickSchemaLoad()
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
          // Prefer Codex-style clientRequestSchema when the package resolved;
          // otherwise fall back to lightweight parseEnvelope.
          if (!cachedClientRequestSchema) {
            try {
              const mod = await optionalImport('@deepseek-ai/dsh-client-connection')
              if (mod?.clientRequestSchema && typeof mod.clientRequestSchema.safeParse === 'function') {
                cachedClientRequestSchema = mod.clientRequestSchema
              }
            } catch {
              // keep parseEnvelope fallback
            }
          }
          const envelope = resolveEnvelope(body, method)
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
