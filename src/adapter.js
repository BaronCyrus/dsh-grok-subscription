import {
  DISPLAY_NAME,
  IMPORT_TIMEOUT_MS,
  MAX_REQUEST_IMAGE_BYTES,
  PROVIDER_ID,
  PROXY_BASE_URL,
  REQUEST_IMAGE_MAX_BYTES,
  REQUEST_IMAGE_PIXEL_BUDGET,
  RESPONSES_URL,
  STREAM_IDLE_TIMEOUT_MS,
} from './constants.js'
import { reasoningInfoOf, toLlmModels, toPiModels } from './catalog.js'
import { buildProxyHeaders, fingerprintHeaders } from './headers.js'

function withImportTimeout(promise, ms, message) {
  let timer
  // Keep the timer ref'd: an unref'd timeout can let the event loop drain before
  // the race settles (and would leave optionalImport hanging in idle hosts/tests).
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * Dynamic import with a hard timeout. Hanging module graphs (pi-ai / peer
 * packages) must not wedge plugin apply / Settings RPC.
 */
export async function optionalImport(specifier, options = {}) {
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : IMPORT_TIMEOUT_MS
  const importFn = typeof options.importFn === 'function'
    ? options.importFn
    : (id => import(id))
  try {
    return await withImportTimeout(
      Promise.resolve(importFn(specifier)),
      timeoutMs,
      `Import timed out after ${timeoutMs}ms: ${specifier}`,
    )
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
    const text = textOf(message.content)
    // Skip empty turns so a prior wipe / reasoning-only assistant does not poison replay.
    if (!text) continue
    input.push({ role, content: text })
  }
  return input
}

function mapFinish(reason) {
  if (reason === 'toolUse' || reason === 'tool_calls') return { kind: 'tool-calls' }
  if (reason === 'length' || reason === 'max_tokens') return { kind: 'max-tokens' }
  return { kind: 'stop' }
}

/** Numbers only when they can survive a JSON round trip. */
function finiteOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Drop everything the host refuses to persist (`undefined`, non-finite numbers,
 * functions, symbols) from an outgoing chunk. DSH aborts the whole turn when a
 * single stream chunk is not losslessly JSON-serializable, and that surfaces to
 * the user as a silent "no reply", so this is the last line of defence.
 */
function jsonSafeChunk(value) {
  if (value === null) return null
  const type = typeof value
  if (type === 'string' || type === 'boolean') return value
  if (type === 'number') return Number.isFinite(value) && !Object.is(value, -0) ? value : undefined
  if (type !== 'object') return undefined
  if (Array.isArray(value)) {
    const list = []
    for (const item of value) {
      const safe = jsonSafeChunk(item)
      if (safe !== undefined) list.push(safe)
    }
    return list
  }
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    const safe = jsonSafeChunk(item)
    if (safe !== undefined) out[key] = safe
  }
  return out
}

async function* streamResponsesUnsafe(options, token) {
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
  if (options.reasoningEffort) {
    body.reasoning = { effort: options.reasoningEffort }
    // Same-wire requirement as openai-responses for xAI-family reasoning models:
    // without encrypted_content, later turns cannot replay reasoning items.
    body.include = ['reasoning.encrypted_content']
  }

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
  let textContent = ''
  let reasoningContent = ''
  let nextIndex = 0
  const toolBlocks = new Map()
  // The arguments.delta event carries no `name`; it is announced on
  // output_item.added / function_call_arguments.done, so remember it by call id.
  const toolNames = new Map()
  let usage
  let finish = { kind: 'stop' }

  const toolIdOf = payload => {
    const id = payload?.item_id ?? payload?.call_id ?? payload?.id
    return typeof id === 'string' && id ? id : undefined
  }

  const learnToolName = (id, name) => {
    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name) return
    toolNames.set(id, name)
    const tool = toolBlocks.get(id)
    if (tool) tool.name = name
  }

  const adoptToolArguments = (id, value) => {
    if (typeof id !== 'string' || typeof value !== 'string' || !value) return
    const tool = toolBlocks.get(id)
    if (tool && value.length > tool.arguments.length) tool.arguments = value
  }

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
      textContent += delta
      yield { type: 'text-delta', index: textIndex, text: String(delta) }
      return
    }
    if (
      type === 'response.reasoning_text.delta'
      || type === 'response.reasoning.delta'
      || type === 'response.reasoning_summary_text.delta'
    ) {
      const delta = payload.delta ?? payload.text ?? ''
      if (!delta) return
      if (reasoningIndex === undefined) {
        reasoningIndex = nextIndex++
        yield { type: 'block-start', index: reasoningIndex, blockType: 'reasoning' }
      }
      reasoningContent += delta
      yield { type: 'reasoning-delta', index: reasoningIndex, text: String(delta) }
      return
    }
    if (type === 'response.output_item.added' || type === 'response.output_item.done') {
      const item = payload.item
      if (item?.type === 'function_call') {
        learnToolName(item.id, item.name)
        learnToolName(item.call_id, item.name)
        adoptToolArguments(item.id, item.arguments)
      }
      return
    }
    if (type === 'response.function_call_arguments.done') {
      const id = toolIdOf(payload)
      learnToolName(id, payload.name)
      adoptToolArguments(id, payload.arguments)
      return
    }
    if (type === 'response.function_call_arguments.delta') {
      const id = toolIdOf(payload)
      if (!id) return
      let tool = toolBlocks.get(id)
      if (!tool) {
        tool = {
          index: nextIndex++,
          id,
          // Never leave this undefined: an unserializable chunk aborts the turn.
          name: toolNames.get(id) ?? 'tool',
          arguments: '',
        }
        toolBlocks.set(id, tool)
        yield { type: 'block-start', index: tool.index, blockType: 'tool-call' }
      }
      const delta = payload.delta ?? payload.arguments ?? ''
      tool.arguments += delta
      yield { type: 'tool-call-delta', index: tool.index, id, name: tool.name, argumentsDelta: String(delta) }
      return
    }
    if (type === 'response.completed') {
      // Recover names/arguments — and any call whose deltas never arrived —
      // from the terminal snapshot before the finish reason is decided.
      for (const item of payload.response?.output ?? []) {
        if (item?.type !== 'function_call') continue
        learnToolName(item.id, item.name)
        learnToolName(item.call_id, item.name)
        const id = typeof item.id === 'string' && item.id ? item.id : undefined
        if (id && !toolBlocks.has(id)) {
          const tool = { index: nextIndex++, id, name: toolNames.get(id) ?? 'tool', arguments: '' }
          toolBlocks.set(id, tool)
          yield { type: 'block-start', index: tool.index, blockType: 'tool-call' }
        }
        adoptToolArguments(id, item.arguments)
      }
      const responseUsage = payload.response?.usage ?? payload.usage
      if (responseUsage) {
        usage = {
          inputTokens: finiteOr(responseUsage.input_tokens ?? responseUsage.prompt_tokens, 0),
          outputTokens: finiteOr(responseUsage.output_tokens ?? responseUsage.completion_tokens, 0),
        }
        usage.totalTokens = finiteOr(responseUsage.total_tokens, usage.inputTokens + usage.outputTokens)
      }
      finish = mapFinish(payload.response?.status === 'incomplete' ? 'length' : 'stop')
      if (toolBlocks.size) finish = { kind: 'tool-calls' }
    }
    if (type === 'response.failed' || type === 'error') {
      const raw = payload.error?.message ?? payload.message
      const failure = {
        message: typeof raw === 'string' && raw ? raw : 'Grok Build stream failed',
        code: 'PROVIDER',
      }
      const status = finiteOr(payload.error?.status, undefined)
      if (status !== undefined) failure.status = status
      finish = { kind: 'error', failure }
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
    yield { type: 'block-end', index: reasoningIndex, block: { type: 'reasoning', text: reasoningContent } }
  }
  if (textIndex !== undefined) {
    yield { type: 'block-end', index: textIndex, block: { type: 'text', text: textContent } }
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
 * Responses SSE stream translated into host chunks, guaranteed to be free of
 * values the host cannot persist. The host rejects the whole turn otherwise.
 */
export async function* streamResponses(options, token) {
  for await (const chunk of streamResponsesUnsafe(options, token)) {
    const safe = jsonSafeChunk(chunk)
    if (safe) yield safe
  }
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
      const raw = session.publicAccount()?.signedIn === true
        ? session.models().find(item => item.id === model)
        : undefined
      const info = {
        provider,
        id: model,
        name: found?.name ?? model,
        inputModalities: ['text'],
        context: { contextWindow: raw?.contextWindow ?? 500_000 },
      }
      const reasoning = reasoningInfoOf(raw)
      if (reasoning) info.reasoning = reasoning
      else if (found?.reasoning) info.reasoning = found.reasoning
      return info
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
      let token = await session.currentToken()
      if (!token) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Grok subscription is not signed in', code: 'MISSING_CREDENTIAL' } } }
        return
      }
      // The token is short-lived and the CLI renews it. When the proxy answers
      // 401 anyway, renew once and retry — but only if nothing was emitted yet,
      // so a partially streamed answer is never duplicated.
      for (let attempt = 0; ; attempt++) {
        let emitted = false
        try {
          for await (const chunk of streamResponses(options, token)) {
            emitted = true
            yield chunk
          }
          return
        } catch (error) {
          const aborted = options.signal?.aborted === true
          const status = finiteOr(error?.status, undefined)
          const canRetry = (
            !aborted
            && !emitted
            && attempt === 0
            && status === 401
            && typeof session.refreshToken === 'function'
          )
          if (canRetry) {
            const renewed = await session.refreshToken()
            if (renewed && renewed !== token) {
              token = renewed
              continue
            }
          }
          const failure = {
            message: status === 401
              ? 'Grok Build session is expired or unauthorized (HTTP 401). Run grok login, then Pull from Grok CLI.'
              : error instanceof Error ? error.message : 'Grok Build request failed',
            code: aborted ? 'ABORTED' : status === 401 ? 'UNAUTHORIZED' : 'PROVIDER',
          }
          if (status !== undefined) failure.status = status
          yield { type: 'finish', reason: { kind: aborted ? 'aborted' : 'error', failure } }
          return
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


/**
 * Force include=reasoning.encrypted_content on every Responses call.
 * pi-ai hard-codes that include for provider "xai" only; grok-build talks to the
 * same family of reasoning models and needs the ciphertext for multi-turn replay.
 */
function withEncryptedReasoningInclude(api) {
  const inject = options => ({
    ...options,
    samplingParams: {
      ...options?.samplingParams,
      include: ['reasoning.encrypted_content'],
    },
  })
  return {
    stream: (model, context, options) => api.stream(model, context, inject(options)),
    streamSimple: (model, context, options) => api.streamSimple(model, context, inject(options)),
  }
}

function wrapAsHostAdapter(candidate, dshLlm) {
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

/**
 * Synchronous duck / host adapter — no dynamic imports of pi-ai or peers.
 * Used so apply() can register immediately and return without wedging the loader.
 */
export function createGrokBuildAdapterSync(session, options = {}) {
  const duck = createDuckAdapter(session)
  const dshLlm = options.dshLlm
  return {
    adapter: wrapAsHostAdapter(duck, dshLlm),
    kind: 'custom-mvp',
    note: 'Registered a sync duck Responses adapter; pi-ai upgrade may follow in the background.',
  }
}

/** Alias for createGrokBuildAdapterSync (no heavy dynamic imports). */
export function createDuckHostAdapter(session, options = {}) {
  return createGrokBuildAdapterSync(session, options)
}

export async function createGrokBuildAdapter(session, options = {}) {
  const importOpts = options.importOptions ?? {}
  const [piAi, dshPi, dshLlm] = await Promise.all([
    optionalImport('@earendil-works/pi-ai', importOpts),
    optionalImport('@deepseek-ai/dsh-llm-pi-ai', importOpts),
    optionalImport('@deepseek-ai/dsh-llm', importOpts),
  ])

  const duck = createDuckAdapter(session)
  const asHostAdapter = candidate => wrapAsHostAdapter(candidate, dshLlm)
  if (!piAi?.createProvider || !dshPi?.PiAiAdapter) {
    return {
      adapter: asHostAdapter(duck),
      kind: 'custom-mvp',
      note: 'PiAiAdapter or @earendil-works/pi-ai is not available in this host; using a documented custom Responses adapter.',
    }
  }

  let responsesApi
  try {
    const lazy = await optionalImport('@earendil-works/pi-ai/api/openai-responses.lazy', importOpts)
    responsesApi = typeof lazy?.openAIResponsesApi === 'function' ? lazy.openAIResponsesApi() : undefined
  } catch {
    responsesApi = undefined
  }
  if (!responsesApi) {
    return { adapter: asHostAdapter(duck), kind: 'custom-mvp', note: 'openai-responses API module is unavailable; using the custom adapter.' }
  }
  // pi-ai only auto-sets include for provider id "xai"; grok-build needs the same
  // encrypted reasoning replay so turn 2+ keeps visible assistant text.
  responsesApi = withEncryptedReasoningInclude(responsesApi)

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
    api: { 'openai-responses': responsesApi },
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
      api: { 'openai-responses': responsesApi },
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
    reasoning: 'high',
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

export { createDuckAdapter, responsesInput, withEncryptedReasoningInclude, wrapAsHostAdapter }
