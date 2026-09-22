import { useEffect, useRef, useState } from 'react'
import { en, zh } from './locales.js'
import { CHANNEL, createRpcClient, unwrap } from './rpc-contract.js'
import { LOCALE_NS, USAGE_PAGE_URL } from './constants.js'

export const inject = ['slots', 'locale', 'connection', 'settingsScope']

/** Client-side safety net so Settings never sticks on Working… forever. */
const RPC_CALL_TIMEOUT_MS = 12_000

function pickCopy(locale) {
  const language = typeof locale === 'string' ? locale : locale?.language ?? locale?.lang
  const resolved = language
    ?? (typeof navigator !== 'undefined' ? navigator.language : 'zh-CN')
  return String(resolved).toLowerCase().startsWith('zh') ? zh : en
}

function sourceLabel(source, t) {
  if (source === 'live') return t('catalogSourceLive')
  if (source === 'fallback') return t('catalogSourceFallback')
  return t('catalogSourceSignedOut')
}

function formatPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

async function callRpc(rpc, endpoint, payload = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  let timer
  try {
    const call = rpc.call(CHANNEL, endpoint, payload, controller?.signal)
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try { controller?.abort() } catch { /* ignore */ }
        reject(new Error(`Request timed out after ${RPC_CALL_TIMEOUT_MS}ms`))
      }, RPC_CALL_TIMEOUT_MS)
    })
    return unwrap(await Promise.race([call, timeout]))
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function UsagePanel({ usage, t, usageBusy, onRefresh, signedIn }) {
  const ok = usage?.status === 'ok'
  const used = ok ? formatPercent(usage.usedPercent) : undefined
  const remaining = ok ? formatPercent(usage.remainingPercent) : undefined
  const resetLabel = usage?.periodEndLocal || usage?.periodEnd

  return (
    <div className="usageBlock">
      <strong>{t('usageTitle')}</strong>
      <p className="muted">{t('usageSubtitle')}</p>
      {ok && used !== undefined ? (
        <>
          <p>
            {t('usageUsed')}: <strong>{used}%</strong>
            {remaining !== undefined ? <> · {t('usageRemaining')} {remaining}%</> : null}
          </p>
          {resetLabel ? (
            <p className="muted">
              {t('usageReset')}: {resetLabel}
              {usage.periodEnd && usage.periodEndLocal ? <> (<code>{usage.periodEnd}</code>)</> : null}
            </p>
          ) : null}
          {Array.isArray(usage.productUsage) && usage.productUsage.length > 0 ? (
            <div>
              <p className="muted">{t('usageProduct')}</p>
              <ul>
                {usage.productUsage.map((row, index) => (
                  <li key={`${row.name ?? 'row'}-${index}`}>
                    {row.name ?? '—'}
                    {typeof row.usedPercent === 'number' ? ` · ${formatPercent(row.usedPercent)}%` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {usage.fetchedAt ? <p className="muted">{t('usageFetchedAt')}: {usage.fetchedAt}</p> : null}
        </>
      ) : (
        <p>
          {t('usageUnavailable')}
          {usage?.reason ? `: ${usage.reason}` : ''}
        </p>
      )}
      {usageBusy ? <p className="muted">{t('busyUsage')}</p> : null}
      <div className="row">
        <button type="button" disabled={Boolean(usageBusy) || !signedIn} onClick={onRefresh}>
          {t('usageRefresh')}
        </button>
        <a href={USAGE_PAGE_URL} target="_blank" rel="noreferrer">{t('usageOpenGrok')}</a>
      </div>
    </div>
  )
}

export function GrokSubscriptionSection({ rpc, t }) {
  const [busy, setBusy] = useState('')
  const [usageBusy, setUsageBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState(undefined)
  const initialUsageKick = useRef(false)

  const applyPartial = (value) => {
    if (value?.account || value?.catalog || value?.usage) {
      setStatus(current => ({ ...current, ...value }))
    }
  }

  const load = async () => {
    const value = await callRpc(rpc, 'status', {})
    setStatus(value)
    setError('')
    return value
  }

  useEffect(() => {
    void load()
      .then(value => {
        // One non-blocking usage refresh on first Settings open when signed in.
        if (initialUsageKick.current) return
        if (value?.account?.signedIn !== true) return
        initialUsageKick.current = true
        void callRpc(rpc, 'usage/refresh', {})
          .then(partial => {
            applyPartial(partial)
          })
          .catch(() => {
            // Fail soft: leave cached / Not fetched yet.
          })
      })
      .catch(item => {
        setNotice('')
        setError(item instanceof Error ? item.message : String(item))
      })
  }, [rpc])

  const kickFollowUpRefresh = () => {
    // Fire-and-forget: never set global busy (keeps Pull/login/logout buttons enabled).
    void callRpc(rpc, 'catalog/refresh', {})
      .then(partial => {
        applyPartial(partial)
      })
      .catch(() => {
        // Soft: catalog may still refresh via background/session kick.
      })
    void callRpc(rpc, 'usage/refresh', {})
      .then(partial => {
        applyPartial(partial)
      })
      .catch(() => {
        // Soft: leave cached usage / Not fetched yet.
      })
  }

  const run = async (endpoint) => {
    const isUsageRefresh = endpoint === 'usage/refresh'
    if (isUsageRefresh) {
      setUsageBusy(true)
    } else {
      setBusy(endpoint)
    }
    setError('')
    setNotice('')
    let value
    try {
      value = await callRpc(rpc, endpoint, {})
      if (value?.account || value?.catalog || value?.usage) {
        applyPartial(value)
      } else {
        await load()
      }
      if (value?.ok === false && value.error) {
        setNotice('')
        setError(value.error)
      } else if (value?.ok !== false) {
        const successKey = {
          pull: 'pullOk',
          'login/cli': 'loginOk',
          'login/device': 'loginOk',
          logout: 'logoutOk',
          'usage/refresh': 'usageRefreshOk',
        }[endpoint]
        if (successKey) setNotice(t(successKey))
      }
    } catch (item) {
      setNotice('')
      setError(item instanceof Error ? item.message : String(item))
    } finally {
      if (isUsageRefresh) setUsageBusy(false)
      else setBusy('')
    }

    // After successful pull/login: busy already cleared + pullOk/loginOk shown.
    // Catalog + usage refresh are fire-and-forget (do not hold Working… / disable buttons).
    const shouldFollowUp = (
      (endpoint === 'pull' || endpoint === 'login/cli' || endpoint === 'login/device')
      && value?.ok !== false
      && !value?.error
    )
    if (shouldFollowUp) kickFollowUpRefresh()
  }

  const account = status?.account
  const catalog = status?.catalog
  const models = catalog?.models ?? []
  const signedIn = account?.signedIn === true

  return (
    <section className="grokSubscription">
      <style>{`
        .grokSubscription { display: grid; gap: 12px; max-width: 42rem; }
        .grokSubscription h2 { margin: 0 0 4px; font-size: 1.15rem; }
        .grokSubscription p, .grokSubscription li { line-height: 1.5; }
        .grokSubscription .muted { opacity: 0.78; font-size: 0.92rem; }
        .grokSubscription .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .grokSubscription button { cursor: pointer; }
        .grokSubscription .error { color: #b42318; }
        .grokSubscription .notice { color: #067647; }
        .grokSubscription ul { margin: 0; padding-left: 1.2rem; }
        .grokSubscription .usageBlock { display: grid; gap: 8px; padding: 10px 0; border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
        .grokSubscription a { color: inherit; }
      `}</style>
      <div>
        <h2>{t('title')}</h2>
        <p className="muted">{t('subtitle')}</p>
      </div>
      <div>
        <strong>{t('account')}: </strong>
        {signedIn ? `${t('signedIn')} · ${account.maskedAccount ?? t('unknownAccount')}` : t('signedOut')}
      </div>
      <div className="row">
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('login/cli')}>{t('loginCli')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('login/device')}>{t('loginDevice')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('pull')}>{t('pull')}</button>
        <button type="button" disabled={Boolean(busy) || !signedIn} onClick={() => void run('logout')}>{t('logout')}</button>
      </div>
      {busy ? <p className="muted">{t('busy')}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="error">{t('error')}: {error}</p> : null}
      <p className="muted">{t('loginHint')}</p>
      <p className="muted">{t('deviceHint')}</p>
      <p className="muted">{t('pullHint')}</p>
      {status?.cliAvailable === false ? <p className="muted">{t('cliMissing')}</p> : null}
      <UsagePanel
        usage={status?.usage}
        t={t}
        usageBusy={usageBusy}
        signedIn={signedIn}
        onRefresh={() => void run('usage/refresh')}
      />
      <div>
        <strong>{t('models')}</strong>
        <p className="muted">{sourceLabel(catalog?.source, t)}</p>
        {models.length === 0 ? <p>{t('noModels')}</p> : (
          <ul>{models.map(model => <li key={model.id}>{model.name} <code>{model.id}</code></li>)}</ul>
        )}
        {catalog?.error ? <p className="error">{t('catalogError')}: {catalog.error}</p> : null}
      </div>
      <p className="muted">{t('caveats')}</p>
    </section>
  )
}

export function apply(ctx) {
  ctx.effect?.(() => ctx.locale?.register?.(LOCALE_NS, { zh, en }), 'grok-subscription: copy')

  // Prefer ctx.get('connection') (listed in inject). Soft-fail if missing so
  // apply never throws while the connection plugin is still loading.
  let connection
  try {
    connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
  } catch {
    connection = undefined
  }
  if (!connection) connection = ctx.connection
  if (!connection?.rpc) {
    try {
      ctx.logger?.warn?.('Grok subscription Settings section skipped: connection unavailable')
    } catch {
      // ignore
    }
    return
  }

  const rpc = createRpcClient(connection.rpc)
  const bound = ctx.locale?.bind?.(LOCALE_NS)
  const t = key => {
    try {
      const value = bound?.(key)
      if (typeof value === 'string' && value && value !== key) return value
    } catch {
      // Fall through to bundled copy.
    }
    return pickCopy(ctx.locale)[key] ?? key
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'grok-subscription',
    order: 16,
    label: () => t('nav'),
    locale: LOCALE_NS,
    inject: () => ({ rpc, t }),
  }, GrokSubscriptionSection))
}

export { pickCopy, callRpc, RPC_CALL_TIMEOUT_MS }
