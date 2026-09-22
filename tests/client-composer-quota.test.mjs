import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fillTemplate,
  formatRemainingPercent,
  formatShortReset,
  isComposerQuotaEnabled,
  QUICK_QUOTA_REFRESH_EVENT,
} from '../src/client-composer-quota-shared.js'
import { PROVIDER_ID } from '../src/constants.js'

test('formatRemainingPercent rounds to one decimal when needed', () => {
  assert.equal(formatRemainingPercent(16), '16')
  assert.equal(formatRemainingPercent(16.04), '16')
  assert.equal(formatRemainingPercent(16.25), '16.3')
  assert.equal(formatRemainingPercent(Number.NaN), undefined)
  assert.equal(formatRemainingPercent(undefined), undefined)
})

test('formatShortReset prefers periodEnd ISO short local form', () => {
  const label = formatShortReset({
    periodEnd: '2026-09-27T06:55:00.000Z',
    periodEndLocal: '2026/09/27 14:55:00',
  })
  assert.ok(typeof label === 'string' && label.length > 0)
  // Must include day and minute fragments (locale-dependent separators).
  assert.match(label, /27/)
  assert.match(label, /55/)
})

test('formatShortReset falls back to periodEndLocal shorthand', () => {
  assert.equal(
    formatShortReset({ periodEndLocal: '2026/09/27 14:55:00' }),
    '9/27 14:55',
  )
  assert.equal(formatShortReset({}), undefined)
})

test('isComposerQuotaEnabled requires grok-build + ok finite remaining', () => {
  assert.equal(isComposerQuotaEnabled(PROVIDER_ID, { status: 'ok', remainingPercent: 16 }), true)
  assert.equal(isComposerQuotaEnabled('openai-codex', { status: 'ok', remainingPercent: 16 }), false)
  assert.equal(isComposerQuotaEnabled(PROVIDER_ID, { status: 'unavailable' }), false)
  assert.equal(isComposerQuotaEnabled(PROVIDER_ID, { status: 'ok', remainingPercent: Number.NaN }), false)
  assert.equal(isComposerQuotaEnabled(PROVIDER_ID, undefined), false)
})

test('fillTemplate substitutes remaining and reset placeholders', () => {
  assert.equal(
    fillTemplate('每周额度 剩余 {remaining}%', { remaining: '16' }),
    '每周额度 剩余 16%',
  )
  assert.equal(
    fillTemplate('Resets {reset}', { reset: '9/27 14:55' }),
    'Resets 9/27 14:55',
  )
})

test('quick quota refresh event name is stable', () => {
  assert.equal(QUICK_QUOTA_REFRESH_EVENT, 'dsh-grok-subscription:refresh-quick-quota')
})
