import { CATALOG_TIMEOUT_MS, FALLBACK_MODEL_IDS, IMAGE_INPUT_MODEL_IDS, MODELS_V2_URL, PROVIDER_ID, PROXY_BASE_URL } from './constants.js'
import { buildProxyHeaders } from './headers.js'

const REASONING_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh'])

function asId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function rowsFromBody(body) {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return []
  if (Array.isArray(body.data)) return body.data
  if (Array.isArray(body.models)) return body.models
  if (Array.isArray(body.items)) return body.items
  return []
}

function contextWindowOf(row) {
  const value = row.contextWindow ?? row.context_window ?? row.context ?? row.max_context
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : undefined
}

function reasoningEffortsOf(row) {
  const raw = row.reasoning_efforts ?? row.reasoningEfforts ?? row.supported_reasoning_efforts
  if (!Array.isArray(raw)) return undefined
  const levels = raw
    .map(item => typeof item === 'string' ? item.trim().toLowerCase() : undefined)
    .filter(item => REASONING_LEVELS.includes(item))
  return levels.length ? [...new Set(levels)] : undefined
}

function displayNameOf(id, row) {
  if (typeof row.name === 'string' && row.name.trim()) return row.name.trim()
  return id.replace(/^grok-/, 'Grok ').replace(/\b\w/g, char => char.toUpperCase()).replace('Grok ', 'Grok ')
}

export function extractLiveModels(body) {
  const seen = new Set()
  const models = []
  for (const row of rowsFromBody(body)) {
    const id = typeof row === 'string' ? asId(row) : asId(row?.id ?? row?.model ?? row?.name)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const object = row && typeof row === 'object' ? row : { id }
    models.push(Object.freeze({
      id,
      name: displayNameOf(id, object),
      contextWindow: contextWindowOf(object) ?? 500_000,
      maxTokens: contextWindowOf(object) ?? 500_000,
      reasoning: object.reasoning !== false,
      reasoningEfforts: reasoningEffortsOf(object),
    }))
  }
  return models
}

export function extractModelIds(body) {
  return extractLiveModels(body).map(model => model.id)
}

export function fallbackModels() {
  return FALLBACK_MODEL_IDS.map(id => Object.freeze({
    id,
    name: id === 'grok-4.7' ? 'Grok 4.7' : id === 'grok-4.6' ? 'Grok 4.6' : 'Grok 4.5',
    contextWindow: 500_000,
    maxTokens: 500_000,
    reasoning: true,
    reasoningEfforts: id === 'grok-4.5' ? ['low', 'medium', 'high'] : ['low', 'medium', 'high', 'xhigh'],
    defaultEffort: 'high',
    source: 'fallback',
  }))
}

export function mergeCatalog(live) {
  if (!Array.isArray(live) || live.length === 0) {
    return fallbackModels().map(model => ({ ...model }))
  }
  return live.map(model => ({ ...model, source: 'live' }))
}

/**
 * Whether this model genuinely accepts image input through the proxy. Verified
 * per model id — see IMAGE_INPUT_MODEL_IDS for the probe results.
 */
export function supportsImageInput(id) {
  return typeof id === 'string' && IMAGE_INPUT_MODEL_IDS.includes(id)
}

export function toPiModels(models) {
  return models.map(model => {
    const efforts = model.reasoningEfforts ?? ['low', 'medium', 'high', 'xhigh']
    const thinkingLevelMap = {
      off: null,
      minimal: null,
      low: efforts.includes('low') ? 'low' : null,
      medium: efforts.includes('medium') ? 'medium' : null,
      high: efforts.includes('high') ? 'high' : null,
      xhigh: efforts.includes('xhigh') ? 'xhigh' : null,
      max: null,
    }
    return {
      id: model.id,
      name: model.name,
      api: 'openai-responses',
      provider: PROVIDER_ID,
      baseUrl: PROXY_BASE_URL,
      reasoning: model.reasoning !== false,
      thinkingLevelMap,
      input: supportsImageInput(model.id) ? ['text', 'image'] : ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.contextWindow ?? 500_000,
      maxTokens: model.maxTokens ?? 500_000,
      compat: { supportsLongCacheRetention: false, supportsDeveloperRole: false },
    }
  })
}

export function reasoningInfoOf(model) {
  if (model?.reasoning === false) return undefined
  const efforts = Array.isArray(model?.reasoningEfforts) && model.reasoningEfforts.length
    ? model.reasoningEfforts
    : ['low', 'medium', 'high', 'xhigh']
  const title = id => `${id.charAt(0).toUpperCase()}${id.slice(1)}`
  const preferred = model?.defaultEffort && efforts.includes(model.defaultEffort)
    ? model.defaultEffort
    : (efforts.includes('high') ? 'high' : efforts[efforts.length - 1])
  return {
    efforts: efforts.map(id => ({ id, name: title(id) })),
    defaultEffort: preferred,
  }
}

export function toLlmModels(models) {
  return models.map(model => {
    const info = {
      provider: PROVIDER_ID,
      id: model.id,
      name: model.name,
      // The bundled adapter inlines images through the host attachment store,
      // so it advertises the same modality map as the official pi-ai path.
      inputModalities: supportsImageInput(model.id) ? ['text', 'image'] : ['text'],
    }
    const reasoning = reasoningInfoOf(model)
    if (reasoning) info.reasoning = reasoning
    return info
  })
}

export async function fetchLiveCatalog(accessToken, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? CATALOG_TIMEOUT_MS)
  const response = await fetchImpl(MODELS_V2_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...buildProxyHeaders(accessToken, options),
    },
    redirect: 'error',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Grok models-v2 returned HTTP ${response.status}`)
  }
  const body = await response.json()
  return extractLiveModels(body)
}

export async function loadCatalog(accessToken, options = {}) {
  if (!accessToken) {
    return { models: [], source: 'signed-out', error: undefined }
  }
  try {
    const live = await fetchLiveCatalog(accessToken, options)
    if (live.length === 0) {
      return { models: mergeCatalog([]), source: 'fallback', error: 'Live models-v2 listing was empty' }
    }
    return { models: mergeCatalog(live), source: 'live', error: undefined }
  } catch (error) {
    return {
      models: mergeCatalog([]),
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Could not refresh Grok model catalog',
    }
  }
}
