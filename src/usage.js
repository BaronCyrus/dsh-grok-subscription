import { BILLING_CREDITS_URL, USAGE_TIMEOUT_MS } from './constants.js'
import { buildProxyHeaders } from './headers.js'

const USAGE_SOURCE = 'billing-credits-undocumented'
const SHANGHAI_TZ = 'Asia/Shanghai'

function unavailable(reason) {
  return Object.freeze({
    status: 'unavailable',
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Usage unavailable',
    experimental: true,
    source: USAGE_SOURCE,
  })
}

function asFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  // Protobuf-ish wrapper: { val: number }
  if (value && typeof value === 'object' && !Array.isArray(value) && 'val' in value) {
    return asFiniteNumber(value.val)
  }
  return undefined
}

function asFinitePercent(value) {
  return asFiniteNumber(value)
}

function asIsoString(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const trimmed = value.trim()
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms)) return undefined
  return new Date(ms).toISOString()
}

function formatShanghai(iso) {
  if (!iso) return undefined
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: SHANGHAI_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return undefined
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function topLevelKeys(body) {
  return Object.keys(body).filter(key => typeof key === 'string').slice(0, 24)
}

function missingPercentReason(body) {
  const keys = topLevelKeys(body)
  const suffix = keys.length ? ` (keys: ${keys.join(',')})` : ''
  return `Missing creditUsagePercent${suffix}`
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function readPercentCandidate(node) {
  if (!isPlainObject(node)) return undefined
  return asFinitePercent(firstDefined(
    node.creditUsagePercent,
    node.usedPercent,
    node.usagePercent,
    node.percentUsed,
    node.used_percent,
    node.usage_percent,
  ))
}

/**
 * Prefer documented live path config.creditUsagePercent; also accept top-level
 * and a few community aliases. Optionally derive used% from used/total.
 */
function resolveUsedPercent(body) {
  const config = isPlainObject(body.config) ? body.config : undefined
  const usage = isPlainObject(body.usage) ? body.usage : undefined
  const credits = isPlainObject(body.credits) ? body.credits : undefined

  const direct = firstDefined(
    readPercentCandidate(body),
    readPercentCandidate(config),
    readPercentCandidate(usage),
    readPercentCandidate(credits),
    asFinitePercent(credits?.usedPercent),
  )
  if (direct !== undefined) return direct

  const used = firstDefined(
    asFiniteNumber(body.used),
    asFiniteNumber(body.includedUsed),
    asFiniteNumber(body.totalUsed),
    asFiniteNumber(config?.includedUsed),
    asFiniteNumber(config?.totalUsed),
    asFiniteNumber(usage?.used),
    asFiniteNumber(credits?.used),
  )
  const total = firstDefined(
    asFiniteNumber(body.total),
    asFiniteNumber(body.monthlyLimit),
    asFiniteNumber(config?.monthlyLimit),
    asFiniteNumber(usage?.total),
    asFiniteNumber(credits?.total),
    asFiniteNumber(credits?.limit),
  )
  if (used !== undefined && total !== undefined && total > 0) {
    return (used / total) * 100
  }
  return undefined
}

function resolvePeriodBounds(body) {
  const config = isPlainObject(body.config) ? body.config : undefined
  const period = firstDefined(
    isPlainObject(config?.currentPeriod) ? config.currentPeriod : undefined,
    isPlainObject(body.currentPeriod) ? body.currentPeriod : undefined,
    isPlainObject(body.period) ? body.period : undefined,
  )

  const start = firstDefined(
    period ? asIsoString(period.start) : undefined,
    asIsoString(config?.billingPeriodStart),
    asIsoString(body.billingPeriodStart),
    asIsoString(body.periodStart),
    asIsoString(body.resetStart),
  )
  const end = firstDefined(
    period ? asIsoString(period.end) : undefined,
    asIsoString(config?.billingPeriodEnd),
    asIsoString(body.billingPeriodEnd),
    asIsoString(body.periodEnd),
    asIsoString(body.resetAt),
    asIsoString(body.reset_at),
  )
  return { start, end }
}

function resolveProductUsage(body) {
  const config = isPlainObject(body.config) ? body.config : undefined
  return firstDefined(
    Array.isArray(body.productUsage) ? body.productUsage : undefined,
    Array.isArray(config?.productUsage) ? config.productUsage : undefined,
    Array.isArray(body.products) ? body.products : undefined,
  )
}

function sanitizeProductUsage(raw) {
  if (!Array.isArray(raw)) return undefined
  const rows = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim()
      : typeof item.product === 'string' && item.product.trim()
        ? item.product.trim()
        : typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : undefined
    const usedPercent = asFinitePercent(firstDefined(
      item.creditUsagePercent,
      item.usedPercent,
      item.usagePercent,
      item.percentUsed,
      item.used_percent,
    ))
    if (!name && usedPercent === undefined) continue
    rows.push(Object.freeze({
      ...(name ? { name } : {}),
      ...(usedPercent !== undefined ? { usedPercent } : {}),
    }))
  }
  return rows.length ? Object.freeze(rows) : undefined
}

/**
 * Parser for GET /v1/billing?format=credits.
 * Live official shape nests fields under `config` (creditUsagePercent,
 * currentPeriod, productUsage). Top-level fields are also accepted.
 * Never invents percentages when no usable percent can be resolved.
 */
export function parseBillingCredits(body) {
  if (body === null || body === undefined) {
    return unavailable('Empty billing response')
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return unavailable('Unexpected billing response shape')
  }

  const usedPercent = resolveUsedPercent(body)
  if (usedPercent === undefined) {
    return unavailable(missingPercentReason(body))
  }

  const { start: periodStart, end: periodEnd } = resolvePeriodBounds(body)
  const productUsage = sanitizeProductUsage(resolveProductUsage(body))
  const remainingPercent = Math.max(0, 100 - usedPercent)

  return Object.freeze({
    status: 'ok',
    experimental: true,
    source: USAGE_SOURCE,
    usedPercent,
    remainingPercent,
    ...(periodStart ? { periodStart, periodStartLocal: formatShanghai(periodStart) } : {}),
    ...(periodEnd ? { periodEnd, periodEndLocal: formatShanghai(periodEnd) } : {}),
    ...(productUsage ? { productUsage } : {}),
  })
}

export function parseBillingCreditsJson(text) {
  if (typeof text !== 'string') return unavailable('Non-text billing response')
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return unavailable('Invalid JSON from billing API')
  }
  return parseBillingCredits(body)
}

export async function fetchBillingUsage(accessToken, options = {}) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return unavailable('Not signed in')
  }
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return unavailable('Fetch unavailable')
  }
  let response
  try {
    const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? USAGE_TIMEOUT_MS)
    response = await fetchImpl(BILLING_CREDITS_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...buildProxyHeaders(accessToken, options),
      },
      redirect: 'error',
      signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network error'
    // Never include request headers or tokens in the reason.
    if (/abort|timeout/i.test(message)) return unavailable('Billing request timed out')
    return unavailable('Billing network error')
  }

  if (response.status === 401 || response.status === 403) {
    return unavailable(`Billing unauthorized (HTTP ${response.status})`)
  }
  if (!response.ok) {
    return unavailable(`Billing HTTP ${response.status}`)
  }

  let text
  try {
    text = await response.text()
  } catch {
    return unavailable('Could not read billing body')
  }
  const parsed = parseBillingCreditsJson(text)
  if (parsed.status === 'ok') {
    return Object.freeze({
      ...parsed,
      fetchedAt: new Date().toISOString(),
    })
  }
  return parsed
}

export { unavailable as unavailableUsage }
