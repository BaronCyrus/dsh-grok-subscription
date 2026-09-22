import {
  DISPLAY_NAME,
  MAX_REQUEST_IMAGE_BYTES,
  PROVIDER_ID,
  PROXY_BASE_URL,
  REQUEST_IMAGE_MAX_BYTES,
  REQUEST_IMAGE_PIXEL_BUDGET,
  RESPONSES_URL,
  STREAM_IDLE_TIMEOUT_MS,
} from './constants.js'
import { toLlmModels, toPiModels } from './catalog.js'
import { buildProxyHeaders, fingerprintHeaders } from './headers.js'

async function optionalImport(specifier) {
  try {
    return await import(specifier)
  } catch {
    return undefined
  }
}

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (typeof block === 'string') return block
      if (block?.type === 'text') return block.text ?? ''
      if (block?.type === 'reasoning') return ''
      if (block?.type === 'tool-result') {
        return typeof block.content === 'string' ? block.content : textOf(block.content)
      }
      return ''
    })
    .join('')
}

function responsesInput(options) {
  const input = []
  const system = typeof options.system === 'string' && options.system ? options.system : undefined
  if (system) input.push({ role: 'system', content: system })
  for (const message of options.messages ?? []) {
    const role = message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user'
    const toolCalls = (message.content ?? []).filter(block => block?.type === 'tool-call')
    const toolResults = (message.content ?? []).filter(block => block?.type === 'tool-result')
    if (toolResults.length) {
      for (const block of toolResults) {
        input.push({
          type: 'function_call_output',
          call_id: block.toolCallId ?? block.id,
          output: textOf(block.content),
        })
      }
      continue
    }
    if (role === 'assistant' && toolCalls.length) {
      for (const block of toolCalls) {
        input.push({
          type: 'function_call',
          call_id: block.id,
          name: block.name,
          arguments: typeof block.arguments === 'string' ? block.arguments : JSON.stringify(block.arguments ?? {}),
        })
      }
      const text = textOf(message.content)
      if (text) input.push({ role: 'assistant', content: text })
      continue
    }
    input.push({ role, content: textOf(message.content) })
  }
  return input
}

function mapFinish(reason) {
  if (reason === 'toolUse' || reason === 'tool_calls') return { kind: 'tool-calls' }
  if (reason === 'length' || reason === 'max_tokens') return { kind: 'max-tokens' }
  return { kind: 'stop' }
}

async function* streamResponses(options, token) {
  const headers = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    ...buildProxyHeaders(token),
  }
  try {
    const llm = await optionalImport('@deepseek-ai/dsh-llm')
    if (typeof llm?.attributionHeaders === 'function') Object.assign(headers, llm.attributionHeaders())
  } catch {
    // Host attribution is optional for this MVP fallback adapter.
  }
  const body = {
    model: options.model,
    input: responsesInput(options),
    stream: true,
  }
  if (typeof options.maxTokens === 'number') body.max_output_tokens = options.maxTokens
  if (typeof options.temperature === 'number') body.temperature = options.temperature
  if (Array.isArray(options.tools) && options.tools.length) {
    body.tools = options.tools.map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))
  }
  if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort }

  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'error',
    signal: options.signal,
  })
  if (!response.ok) {
    const error = new Error(`Grok Build proxy returned HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  if (!response.body) throw new Error('Grok Build proxy returned an empty body')

  const decoder = new TextDecoder()
  let buffer = ''
  let textIndex
  let reasoningIndex
  let nextIndex = 0
  const toolBlocks = new Map()
  let usage
  let finish = { kind: 'stop' }

  const flushSse = function* (raw) {
    const lines = raw.split('\n')
    let event = 'message'
    const data = []
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    const payloadText = data.join('\n')
    if (!payloadText || payloadText === '[DONE]') return
    let payload
    try {
      payload = JSON.parse(payloadText)
    } catch {
      return
    }
    const type = payload.type ?? event
    if (type === 'response.output_text.delta' || type === 'response.text.delta') {
      const delta = payload.delta ?? payload.text ?? ''
      if (!delta) return
      if (textIndex === undefined) {
        textIndex = nextIndex++
        yield { type: 'block-start', index: textIndex, blockType: 'text' }
      }
      yield { type: 'text-delta', index: textIndex, text: String(delta) }
      return
    }
    if (type === 'response.reasoning_text.delta' || type === 'response.reasoning.delta') {
      const delta = payload.delta ?? payload.text ?? ''
      if (!delta) return
      if (reasoningIndex === undefined) {
        reasoningIndex = nextIndex++
        yield { type: 'block-start', index: reasoningIndex, blockType: 'reasoning' }
      }
      yield { type: 'reasoning-delta', index: reasoningIndex, text: String(delta) }
      return
    }
    if (type === 'response.function_call_arguments.delta') {
      const id = payload.item_id ?? payload.call_id ?? payload.id
      if (!id) return
      let tool = toolBlocks.get(id)
      if (!tool) {
        tool = { index: nextIndex++, id, name: payload.name ?? payload.item?.name, arguments: '' }
        toolBlocks.set(id, tool)
        yield { type: 'block-start', index: tool.index, blockType: 'tool-call' }
      }
      const delta = payload.delta ?? payload.arguments ?? ''
      tool.arguments += delta
      yield { type: 'tool-call-delta', index: tool.index, id, name: tool.name, argumentsDelta: String(delta) }
      return
    }
    if (type === 'response.completed') {
      const responseUsage = payload.response?.usage ?? payload.usage
      if (responseUsage) {
        usage = {
          inputTokens: responseUsage.input_tokens ?? responseUsage.prompt_tokens ?? 0,
          outputTokens: responseUsage.output_tokens ?? responseUsage.completion_tokens ?? 0,
          totalTokens: responseUsage.total_tokens,
        }
      }
      finish = mapFinish(payload.response?.status === 'incomplete' ? 'length' : 'stop')
      if (toolBlocks.size) finish = { kind: 'tool-calls' }
    }
    if (type === 'response.failed' || type === 'error') {
      const message = payload.error?.message ?? payload.message ?? 'Grok Build stream failed'
      finish = { kind: 'error', failure: { message, code: 'PROVIDER', status: payload.error?.status } }
    }
  }

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })
    let separator
    while ((separator = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      yield* flushSse(raw)
    }
  }
  if (buffer.trim()) yield* flushSse(buffer)

  if (reasoningIndex !== undefined) {
    yield { type: 'block-end', index: reasoningIndex, block: { type: 'reasoning', text: '' } }
  }
  if (textIndex !== undefined) {
    yield { type: 'block-end', index: textIndex, block: { type: 'text', text: '' } }
  }
  for (const tool of toolBlocks.values()) {
    yield {
      type: 'block-end',
      index: tool.index,
      block: { type: 'tool-call', id: tool.id, name: tool.name ?? 'tool', arguments: tool.arguments },
    }
  }
  if (usage) yield { type: 'usage', usage }
  yield { type: 'finish', reason: finish }
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

function createDuckAdapter(session) {
  const providerInfo = () => ({ id: PROVIDER_ID, name: DISPLAY_NAME })
  const list = () => {
    const signedIn = session.publicAccount()?.signedIn === true
    return signedIn ? toLlmModels(session.models()) : []
  }
  return {
    providerInfo,
    providerRetryPolicy() { return undefined },
    async listModels(provider) {
      if (provider !== PROVIDER_ID) return []
      return list()
    },
    async resolveModel(provider, model) {
      const found = list().find(item => item.id === model)
      return {
        provider,
        id: model,
        name: found?.name ?? model,
        inputModalities: ['text'],
        context: { contextWindow: 500_000 },
      }
    },
    async prepareCall(provider, model, signal) {
      const resolved = await this.resolveModel(provider, model, signal)
      return {
        model: resolved,
        stream: options => this.stream(options),
      }
    },
    async *stream(options) {
      if (options.provider !== PROVIDER_ID) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Unknown provider', code: 'NO_ADAPTER' } } }
        return
      }
      const token = await session.currentToken()
      if (!token) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Grok subscription is not signed in', code: 'MISSING_CREDENTIAL' } } }
        return
      }
      try {
        yield* streamResponses(options, token)
      } catch (error) {
        const aborted = options.signal?.aborted === true
        yield {
          type: 'finish',
          reason: {
            kind: aborted ? 'aborted' : 'error',
            failure: {
              message: error instanceof Error ? error.message : 'Grok Build request failed',
              code: aborted ? 'ABORTED' : 'PROVIDER',
              status: error?.status,
            },
          },
        }
      }
    },
  }
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

export async function createGrokBuildAdapter(session) {
  const [piAi, dshPi, dshLlm] = await Promise.all([
    optionalImport('@earendil-works/pi-ai'),
    optionalImport('@deepseek-ai/dsh-llm-pi-ai'),
    optionalImport('@deepseek-ai/dsh-llm'),
  ])

  const duck = createDuckAdapter(session)
  const asHostAdapter = candidate => {
    if (!dshLlm?.LlmAdapter || candidate instanceof dshLlm.LlmAdapter) return candidate
    class GrokBuildAdapter extends dshLlm.LlmAdapter {
      providerInfo(provider) { return candidate.providerInfo(provider) }
      providerRetryPolicy(provider) { return candidate.providerRetryPolicy(provider) }
      listModels(provider) { return candidate.listModels(provider) }
      resolveModel(provider, model, signal) { return candidate.resolveModel(provider, model, signal) }
      prepareCall(provider, model, signal) { return candidate.prepareCall(provider, model, signal) }
      stream(options) { return candidate.stream(options) }
    }
    return new GrokBuildAdapter()
  }
  if (!piAi?.createProvider || !dshPi?.PiAiAdapter) {
    return {
      adapter: asHostAdapter(duck),
      kind: 'custom-mvp',
      note: 'PiAiAdapter or @earendil-works/pi-ai is not available in this host; using a documented custom Responses adapter.',
    }
  }

  let responsesApi
  try {
    const lazy = await import('@earendil-works/pi-ai/api/openai-responses.lazy')
    responsesApi = typeof lazy.openAIResponsesApi === 'function' ? lazy.openAIResponsesApi() : undefined
  } catch {
    responsesApi = undefined
  }
  if (!responsesApi) {
    return { adapter: asHostAdapter(duck), kind: 'custom-mvp', note: 'openai-responses API module is unavailable; using the custom adapter.' }
  }

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
    api: responsesApi,
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
      api: responsesApi,
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
  })

  return {
    adapter,
    kind: 'pi-ai',
    note: undefined,
    provider: buildLiveProvider(),
    refresh: () => authModels.refresh({ allowNetwork: true, force: true }),
  }
}

export { createDuckAdapter }
