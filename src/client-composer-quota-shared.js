import { PROVIDER_ID } from './constants.js'

export const QUICK_QUOTA_REFRESH_EVENT = 'dsh-grok-subscription:refresh-quick-quota'
export const QUICK_QUOTA_REFRESH_MS = 60_000

export const COMPOSER_QUOTA_STYLE = `
.grokComposerQuota:focus-visible{outline:1px solid var(--dsw-alias-border-l3);outline-offset:2px}
.grokComposerQuota{display:inline-flex;align-items:center;gap:9px;flex:0 0 auto;height:28px;box-sizing:border-box;padding:0 5px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.grokComposerQuota:hover,.grokComposerQuota[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}
.grokQuotaPopover{position:fixed;z-index:1000;width:max-content;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 4px 16px #0002;font-size:12px;line-height:20px;outline:none}
.grokQuotaDetail>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.grokQuotaDetail strong{font-weight:500}
.grokQuotaReset{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}
`

export function fillTemplate(text, values) {
  return Object.entries(values).reduce(
    (next, [key, value]) => next.replaceAll(`{${key}}`, String(value)),
    String(text ?? ''),
  )
}

export function formatRemainingPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Short local reset label: month/day hour:minute (Codex shortReset style). */
export function formatShortReset(usage) {
  if (!usage || typeof usage !== 'object') return undefined
  const iso = typeof usage.periodEnd === 'string' ? usage.periodEnd : undefined
  if (iso) {
    const ms = Date.parse(iso)
    if (Number.isFinite(ms)) {
      return new Date(ms).toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }
  const local = typeof usage.periodEndLocal === 'string' ? usage.periodEndLocal.trim() : ''
  if (!local) return undefined
  // "2026/09/27 14:55:00" → "9/27 14:55" when possible
  const match = local.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (match) {
    return `${Number(match[2])}/${Number(match[3])} ${match[4]}:${match[5]}`
  }
  return local
}

export function isComposerQuotaEnabled(provider, usage) {
  if (provider !== PROVIDER_ID) return false
  if (!usage || usage.status !== 'ok') return false
  return typeof usage.remainingPercent === 'number' && Number.isFinite(usage.remainingPercent)
}

export function notifyQuickQuota() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(QUICK_QUOTA_REFRESH_EVENT))
    }
  } catch {
    // ignore
  }
}
