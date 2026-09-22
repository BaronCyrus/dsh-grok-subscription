import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { PROVIDER_ID } from './constants.js'
import { CHANNEL, unwrap } from './rpc-contract.js'
import {
  COMPOSER_QUOTA_STYLE,
  QUICK_QUOTA_REFRESH_EVENT,
  QUICK_QUOTA_REFRESH_MS,
  fillTemplate,
  formatRemainingPercent,
  formatShortReset,
  isComposerQuotaEnabled,
  notifyQuickQuota,
} from './client-composer-quota-shared.js'

export {
  COMPOSER_QUOTA_STYLE,
  QUICK_QUOTA_REFRESH_EVENT,
  QUICK_QUOTA_REFRESH_MS,
  fillTemplate,
  formatRemainingPercent,
  formatShortReset,
  isComposerQuotaEnabled,
  notifyQuickQuota,
}

const QUICK_RPC_TIMEOUT_MS = 12_000

async function quickCall(rpc, endpoint) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  let timer
  try {
    const call = rpc.call(CHANNEL, endpoint, {}, controller?.signal)
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try { controller?.abort() } catch { /* ignore */ }
        reject(new Error(`Request timed out after ${QUICK_RPC_TIMEOUT_MS}ms`))
      }, QUICK_RPC_TIMEOUT_MS)
    })
    return unwrap(await Promise.race([call, timeout]))
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function useAnchoredPositionFallback({ open, anchorRef }) {
  const [position, setPosition] = useState(null)
  useEffect(() => {
    if (!open || !anchorRef?.current) {
      setPosition(null)
      return undefined
    }
    const place = () => {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({
        position: 'fixed',
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 12)),
        top: Math.max(12, rect.top - 8),
        transform: 'translateY(-100%)',
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef])
  return position
}

function useDismissOnOutsidePointerFallback(triggerRef, open, dismiss, panelRef) {
  useEffect(() => {
    if (!open) return undefined
    const onPointer = event => {
      const target = event.target
      if (triggerRef.current?.contains?.(target) || panelRef.current?.contains?.(target)) return
      dismiss()
    }
    document.addEventListener('pointerdown', onPointer, true)
    return () => document.removeEventListener('pointerdown', onPointer, true)
  }, [open, triggerRef, panelRef, dismiss])
}

function loadAnchoringHooks() {
  try {
    // Runtime soft-require: keep Settings loadable when primitives are absent.
    // eslint-disable-next-line no-undef
    const req = typeof require === 'function' ? require : undefined
    const mod = req?.('@deepseek-ai/dsh-client-ui-primitives')
    if (mod?.useAnchoredPosition && mod?.useDismissOnOutsidePointer) {
      return {
        useAnchoredPosition: mod.useAnchoredPosition,
        useDismissOnOutsidePointer: mod.useDismissOnOutsidePointer,
      }
    }
  } catch {
    // soft-fail to local positioning
  }
  return {
    useAnchoredPosition: useAnchoredPositionFallback,
    useDismissOnOutsidePointer: useDismissOnOutsidePointerFallback,
  }
}

const anchoring = loadAnchoringHooks()

/**
 * When enabled: load via status/usage, then soft usage/refresh.
 * Poll every ~60s; listen for dsh-grok-subscription:refresh-quick-quota.
 */
export function useGrokQuickQuota(rpc, enabled) {
  const [usage, setUsage] = useState(undefined)

  useEffect(() => {
    if (!enabled) {
      setUsage(undefined)
      return undefined
    }

    let live = true
    let loading = false

    const accept = next => {
      if (!live) return
      if (next && next.status === 'ok' && typeof next.remainingPercent === 'number' && Number.isFinite(next.remainingPercent)) {
        setUsage(next)
      } else {
        setUsage(undefined)
      }
    }

    const softRefresh = () => {
      void quickCall(rpc, 'usage/refresh')
        .then(value => {
          if (value?.usage) accept(value.usage)
        })
        .catch(() => {
          // soft
        })
    }

    const load = async () => {
      if (loading) return
      loading = true
      try {
        let status
        try {
          status = await quickCall(rpc, 'status')
        } catch {
          status = undefined
        }
        if (!live) return

        if (status?.account?.signedIn !== true) {
          try {
            const value = await quickCall(rpc, 'usage')
            accept(value?.usage)
          } catch {
            accept(undefined)
          }
          return
        }

        let next = status?.usage
        if (!next || next.status !== 'ok') {
          try {
            const value = await quickCall(rpc, 'usage')
            next = value?.usage ?? next
          } catch {
            // keep status.usage
          }
        }
        if (!live) return
        accept(next)
        softRefresh()
      } catch {
        if (live) setUsage(undefined)
      } finally {
        loading = false
      }
    }

    const refresh = () => { void load() }
    void load()
    const timer = window.setInterval(refresh, QUICK_QUOTA_REFRESH_MS)
    window.addEventListener(QUICK_QUOTA_REFRESH_EVENT, refresh)
    return () => {
      live = false
      window.clearInterval(timer)
      window.removeEventListener(QUICK_QUOTA_REFRESH_EVENT, refresh)
    }
  }, [rpc, enabled])

  return usage
}

export function GrokComposerQuota({ rpc, t, directory }) {
  const modelState = useSyncExternalStore(
    listener => directory.subscribe(listener),
    () => directory.getSnapshot(),
  )
  const current = modelState?.current
  const provider = current?.provider
  const providerEnabled = provider === PROVIDER_ID
  const usage = useGrokQuickQuota(rpc, providerEnabled)
  const enabled = isComposerQuotaEnabled(provider, usage)
  const remaining = enabled ? formatRemainingPercent(usage.remainingPercent) : undefined

  const [open, setOpen] = useState(false)
  const trigger = useRef(null)
  const panel = useRef(null)
  const pinned = useRef(false)
  const dismissTimer = useRef(null)
  const enter = () => { clearTimeout(dismissTimer.current); setOpen(true) }
  const leave = () => { if (!pinned.current) dismissTimer.current = setTimeout(() => setOpen(false), 150) }
  const dismiss = () => { pinned.current = false; setOpen(false) }
  useEffect(() => () => clearTimeout(dismissTimer.current), [])
  const id = useId()
  const visible = open && enabled && remaining !== undefined
  const position = anchoring.useAnchoredPosition({
    open: visible,
    anchorRef: trigger,
    panelRef: panel,
    side: 'top',
    gap: 8,
    margin: 12,
  })
  anchoring.useDismissOnOutsidePointer(trigger, visible, dismiss, panel)

  useEffect(() => { setOpen(false) }, [current?.model, enabled])
  useEffect(() => {
    if (!visible) return undefined
    const escape = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dismiss()
      trigger.current?.focus?.()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [visible])

  if (!enabled || remaining === undefined) return null

  const reset = formatShortReset(usage)
  const remainingLine = fillTemplate(t('composerQuotaRemaining'), { remaining })
  const resetLine = reset
    ? fillTemplate(t('composerQuotaResets'), { reset })
    : t('composerQuotaResetUnknown')
  const detailsLabel = `${remainingLine} ${resetLine}`

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="grokComposerQuota"
        title={detailsLabel}
        aria-label={`${t('composerQuotaDetails')}: ${detailsLabel}`}
        aria-haspopup="dialog"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onClick={() => {
          if (pinned.current) dismiss()
          else {
            pinned.current = true
            setOpen(true)
            requestAnimationFrame(() => panel.current?.focus?.())
          }
        }}
      >
        <span>{`${remaining}%`}</span>
      </button>
      {visible ? createPortal(
        <section
          ref={panel}
          id={id}
          role="dialog"
          aria-label={t('composerQuotaDetails')}
          className="grokQuotaPopover"
          tabIndex={-1}
          onMouseEnter={enter}
          onMouseLeave={leave}
          style={{ ...(position || {}), visibility: position ? 'visible' : 'hidden' }}
        >
          <div className="grokQuotaDetail">
            <div>
              <strong>{remainingLine}</strong>
              <span className="grokQuotaReset">{resetLine}</span>
            </div>
          </div>
        </section>,
        document.body,
      ) : null}
    </>
  )
}
