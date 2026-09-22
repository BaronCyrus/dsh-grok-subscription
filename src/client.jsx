import { useEffect, useRef, useState } from 'react'
import { en, zh } from './locales.js'
import { CHANNEL, createRpcClient, unwrap } from './rpc-contract.js'
import { LOCALE_NS, USAGE_PAGE_URL } from './constants.js'
import { SETTINGS_STYLE } from './client-settings-style.js'
import {
  COMPOSER_QUOTA_STYLE,
  GrokComposerQuota,
  notifyQuickQuota,
} from './client-composer-quota.jsx'

export const inject = [
  'slots', 'locale', 'connection', 'settingsScope', 'modelDirectories', 'sessions', 'remote',
]

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

function Chevron() {
  return (
    <svg className="gsChevron" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Chip({ tone = 'off', children }) {
  return <span className={`gsChip gsChip--${tone}`}><span className="gsDot" />{children}</span>
}

function UsagePanel({ usage, t, usageBusy, onRefresh, signedIn }) {
  const ok = usage?.status === 'ok'
  const used = ok ? formatPercent(usage.usedPercent) : undefined
  const remaining = ok ? formatPercent(usage.remainingPercent) : undefined
  const resetLabel = usage?.periodEndLocal || usage?.periodEnd
  // Show what is left when the backend reports it, otherwise fall back to used.
  const gaugeValue = remaining ?? (used !== undefined ? formatPercent(100 - Number(used)) : undefined)
  const gaugeLabel = remaining !== undefined ? t('usageRemaining') : t('usageUsed')
  const fill = typeof gaugeValue === 'number' && Number.isFinite(gaugeValue)
    ? Math.min(100, Math.max(0, gaugeValue))
    : 0

  return (
    <div className="gsCard">
      <div className="gsCardHead">
        <h3>{t('usageTitle')}</h3>
      </div>
      {ok && (used !== undefined || remaining !== undefined) ? (
        <div className="gsGauge">
          <div className="gsGaugeTop">
            {gaugeValue !== undefined ? <span className="gsGaugeValue">{gaugeValue}%</span> : null}
            <span className="gsGaugeLabel">{gaugeLabel}</span>
          </div>
          <div className="gsBar" role="img" aria-label={`${gaugeLabel} ${gaugeValue ?? 0}%`}>
            <span style={{ width: `${fill}%` }} />
          </div>
          <div className="gsGaugeMeta">
            <span>{t('usageUsed')} {used ?? '—'}%</span>
            {resetLabel ? <span>{t('usageReset')} {resetLabel}</span> : null}
            {usage.periodEnd && usage.periodEndLocal ? <code>{usage.periodEnd}</code> : null}
          </div>
        </div>
      ) : (
        <p className="gsEmpty">
          {t('usageUnavailable')}
          {usage?.reason ? `: ${usage.reason}` : ''}
        </p>
      )}
      {Array.isArray(usage.productUsage) && usage.productUsage.length > 0 ? (
        <div className="gsRows">
          {usage.productUsage.map((row, index) => (
            <div className="gsRow" key={`${row.name ?? 'row'}-${index}`}>
              <span>{row.name ?? '—'}</span>
              <span className="gsRowValue">
                {typeof row.usedPercent === 'number' ? `${formatPercent(row.usedPercent)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {usage.fetchedAt ? <p className="gsHint">{t('usageFetchedAt')}: {usage.fetchedAt}</p> : null}
      {usageBusy ? <p className="gsStatus gsStatus--busy">{t('busyUsage')}</p> : null}
      <p className="gsHint">{t('usageSubtitle')}</p>
      <div className="gsActions">
        <button className="gsBtn" type="button" disabled={Boolean(usageBusy) || !signedIn} onClick={onRefresh}>
          {t('usageRefresh')}
        </button>
        <a className="gsLink" href={USAGE_PAGE_URL} target="_blank" rel="noreferrer">{t('usageOpenGrok')}</a>
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
            notifyQuickQuota()
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
        notifyQuickQuota()
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
          'catalog/refresh': 'catalogRefreshOk',
        }[endpoint]
        if (successKey) setNotice(t(successKey))
        if (endpoint === 'usage/refresh' && value?.ok !== false && !value?.error) {
          notifyQuickQuota()
        }
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
      <style>{SETTINGS_STYLE}</style>
      <div className="gsHead">
        <h2>{t('title')}</h2>
        <Chip tone={signedIn ? 'ok' : 'off'}>{signedIn ? t('signedIn') : t('signedOut')}</Chip>
      </div>
      <p className="gsLead">{t('subtitle')}</p>

      <div className="gsCard">
        <div className="gsCardHead">
          <h3>{t('account')}</h3>
          {signedIn && account?.maskedAccount ? <span className="gsAccount">{account.maskedAccount}</span> : null}
        </div>
        <div className="gsActions">
          <button className="gsBtn gsBtn--primary" type="button" disabled={Boolean(busy)} onClick={() => void run('login/cli')}>{t('loginCli')}</button>
          <button className="gsBtn" type="button" disabled={Boolean(busy)} onClick={() => void run('login/device')}>{t('loginDevice')}</button>
          <button className="gsBtn" type="button" disabled={Boolean(busy)} onClick={() => void run('pull')}>{t('pull')}</button>
          <button className="gsBtn gsBtn--danger" type="button" disabled={Boolean(busy) || !signedIn} onClick={() => void run('logout')}>{t('logout')}</button>
        </div>
        {busy ? <p className="gsStatus gsStatus--busy">{t('busy')}</p> : null}
        {notice ? <p className="gsStatus gsStatus--ok">{notice}</p> : null}
        {error ? <p className="gsStatus gsStatus--error">{t('error')}: {error}</p> : null}
        {status?.cliAvailable === false ? <p className="gsStatus gsStatus--warn">{t('cliMissing')}</p> : null}
        <details className="gsDisclosure">
          <summary><Chevron />{t('loginHelp')}</summary>
          <div className="gsDisclosureBody">
            <p>{t('loginHint')}</p>
            <p>{t('deviceHint')}</p>
            <p>{t('pullHint')}</p>
          </div>
        </details>
      </div>

      <UsagePanel
        usage={status?.usage}
        t={t}
        usageBusy={usageBusy}
        signedIn={signedIn}
        onRefresh={() => void run('usage/refresh')}
      />

      <div className="gsCard">
        <div className="gsCardHead">
          <h3>{t('models')}</h3>
          <span className="gsSpacer" />
          <Chip tone={catalog?.source === 'live' ? 'ok' : catalog?.source === 'fallback' ? 'warn' : 'off'}>
            {sourceLabel(catalog?.source, t)}
          </Chip>
        </div>
        {models.length === 0 ? (
          <p className="gsEmpty">{t('noModels')}</p>
        ) : (
          <div className="gsModels">
            {models.map(model => (
              <span className="gsModel" key={model.id}>
                {model.name} <code>{model.id}</code>
              </span>
            ))}
          </div>
        )}
        {catalog?.error ? <p className="gsStatus gsStatus--error">{t('catalogError')}: {catalog.error}</p> : null}
        <div className="gsActions">
          <button className="gsBtn" type="button" disabled={!signedIn} onClick={() => void run('catalog/refresh')}>
            {t('refreshCatalog')}
          </button>
        </div>
      </div>

      <p className="gsCaveat">{t('caveats')}</p>
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

  ctx.effect?.(() => {
    if (typeof document === 'undefined') return undefined
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-grok-subscription'
    tag.textContent = COMPOSER_QUOTA_STYLE
    document.head.append(tag)
    return () => tag.remove()
  }, 'grok-subscription: composer-quota-style')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'grok-subscription',
    order: 16,
    label: () => t('nav'),
    locale: LOCALE_NS,
    inject: () => ({ rpc, t }),
  }, GrokSubscriptionSection))

  const installDirectorySlots = scope => {
    let modelDirectories
    try {
      modelDirectories = typeof scope.get === 'function' ? scope.get('modelDirectories') : undefined
    } catch {
      modelDirectories = undefined
    }
    if (!modelDirectories?.directoryFor) {
      try {
        ctx.logger?.warn?.('Grok composer quota skipped: modelDirectories unavailable')
      } catch {
        // ignore
      }
      return
    }
    scope.slots.inject('conversation.input.right', () => scope.slots.register({
      name: 'conversation.input.right',
      id: 'grok-subscription-quota',
      order: 16,
      locale: LOCALE_NS,
      inject: sessionId => ({
        rpc,
        t,
        directory: modelDirectories.directoryFor(sessionId).store,
      }),
    }, GrokComposerQuota))
  }

  try {
    const remoteSession = typeof ctx.get === 'function' ? ctx.get('remote.session') : undefined
    if (remoteSession === undefined) installDirectorySlots(ctx)
    else ctx.inject(['remote.session'], installDirectorySlots)
  } catch {
    installDirectorySlots(ctx)
  }
}

export { pickCopy, callRpc, RPC_CALL_TIMEOUT_MS }
