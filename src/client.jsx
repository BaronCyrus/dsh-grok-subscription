import { useEffect, useState } from 'react'
import { en, zh } from './locales.js'
import { CHANNEL, createRpcClient, unwrap } from './rpc-contract.js'
import { LOCALE_NS } from './constants.js'

export const inject = ['slots', 'locale', 'connection', 'settingsScope']

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

export function GrokSubscriptionSection({ rpc, t }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState(undefined)

  const load = async () => {
    const value = unwrap(await rpc.call(CHANNEL, 'status', {}))
    setStatus(value)
    setError('')
  }

  useEffect(() => {
    void load().catch(item => {
      setNotice('')
      setError(item instanceof Error ? item.message : String(item))
    })
  }, [rpc])

  const run = async (endpoint) => {
    setBusy(endpoint)
    setError('')
    setNotice('')
    try {
      const value = unwrap(await rpc.call(CHANNEL, endpoint, {}))
      if (value?.account || value?.catalog) setStatus(current => ({ ...current, ...value }))
      else await load()
      if (value?.ok === false && value.error) {
        setNotice('')
        setError(value.error)
      } else if (value?.ok !== false) {
        const successKey = {
          pull: 'pullOk',
          'login/cli': 'loginOk',
          'login/device': 'loginOk',
          logout: 'logoutOk',
        }[endpoint]
        if (successKey) setNotice(t(successKey))
      }
    } catch (item) {
      setNotice('')
      setError(item instanceof Error ? item.message : String(item))
    } finally {
      setBusy('')
    }
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
        .grokSubscription .row { display: flex; flex-wrap: wrap; gap: 8px; }
        .grokSubscription button { cursor: pointer; }
        .grokSubscription .error { color: #b42318; }
        .grokSubscription .notice { color: #067647; }
        .grokSubscription ul { margin: 0; padding-left: 1.2rem; }
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

  const connection = ctx.get?.('connection') ?? ctx.connection
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

export { pickCopy }
