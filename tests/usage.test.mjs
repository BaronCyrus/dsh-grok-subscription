import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBillingCredits, parseBillingCreditsJson, fetchBillingUsage } from '../src/usage.js'

test('parses a valid billing credits body (top-level percent, forward-compat)', () => {
  const parsed = parseBillingCredits({
    creditUsagePercent: 37.5,
    config: {
      currentPeriod: {
        start: '2026-09-15T00:00:00.000Z',
        end: '2026-09-22T00:00:00.000Z',
      },
    },
    productUsage: [
      { name: 'chat', creditUsagePercent: 20 },
      { product: 'images', usedPercent: 10 },
      { id: 'skip-me' },
    ],
  })
  assert.equal(parsed.status, 'ok')
  assert.equal(parsed.experimental, true)
  assert.equal(parsed.usedPercent, 37.5)
  assert.equal(parsed.remainingPercent, 62.5)
  assert.equal(parsed.periodStart, '2026-09-15T00:00:00.000Z')
  assert.equal(parsed.periodEnd, '2026-09-22T00:00:00.000Z')
  assert.equal(typeof parsed.periodEndLocal, 'string')
  assert.ok(parsed.periodEndLocal.length > 0)
  assert.equal(parsed.productUsage.length, 3)
  assert.equal(parsed.productUsage[0].name, 'chat')
  assert.equal(parsed.productUsage[0].usedPercent, 20)
  assert.equal(parsed.productUsage[1].name, 'images')
  assert.equal(parsed.productUsage[1].usedPercent, 10)
})

test('parses confirmed live nested config shape (creditUsagePercent under config)', () => {
  // Exact shape confirmed from DSH tester HTTP 200 billing response (v0.1.4 QA).
  const live = {
    config: {
      currentPeriod: {
        type: 'USAGE_PERIOD_TYPE_WEEKLY',
        start: '2026-09-21T16:46:29.886619+00:00',
        end: '2026-09-28T16:46:29.886619+00:00',
      },
      creditUsagePercent: 3,
      onDemandCap: { val: 0 },
      onDemandUsed: { val: 0 },
      productUsage: [
        { product: 'GrokAppBuilder', usagePercent: 3 },
        { product: 'GrokBuild' },
        { product: 'GrokImagine' },
      ],
      isUnifiedBillingUser: true,
      prepaidBalance: { val: 0 },
      topUpMethod: 'TOP_UP_METHOD_SAVED_PAYMENT_METHOD',
      billingPeriodStart: '2026-09-21T16:46:29.886619+00:00',
      billingPeriodEnd: '2026-09-28T16:46:29.886619+00:00',
    },
  }
  const parsed = parseBillingCredits(live)
  assert.equal(parsed.status, 'ok')
  assert.equal(parsed.usedPercent, 3)
  assert.equal(parsed.remainingPercent, 97)
  assert.equal(parsed.periodStart, '2026-09-21T16:46:29.886Z')
  assert.equal(parsed.periodEnd, '2026-09-28T16:46:29.886Z')
  assert.equal(typeof parsed.periodEndLocal, 'string')
  assert.ok(parsed.periodEndLocal.length > 0)
  assert.equal(parsed.productUsage.length, 3)
  assert.equal(parsed.productUsage[0].name, 'GrokAppBuilder')
  assert.equal(parsed.productUsage[0].usedPercent, 3)
  assert.equal(parsed.productUsage[1].name, 'GrokBuild')
  assert.equal(parsed.productUsage[1].usedPercent, undefined)
  assert.equal(parsed.productUsage[2].name, 'GrokImagine')
})

test('derives usedPercent from used/total when percent fields absent', () => {
  const parsed = parseBillingCredits({
    config: {
      includedUsed: 25,
      monthlyLimit: 100,
      currentPeriod: { end: '2026-09-29T00:00:00.000Z' },
    },
  })
  assert.equal(parsed.status, 'ok')
  assert.equal(parsed.usedPercent, 25)
  assert.equal(parsed.remainingPercent, 75)
  assert.equal(parsed.periodEnd, '2026-09-29T00:00:00.000Z')
})

test('fails closed when creditUsagePercent is missing and lists top-level keys', () => {
  const parsed = parseBillingCredits({
    config: { currentPeriod: { end: '2026-09-22T00:00:00.000Z' } },
  })
  assert.equal(parsed.status, 'unavailable')
  assert.match(parsed.reason, /creditUsagePercent/i)
  assert.match(parsed.reason, /keys:\s*config/i)
  assert.equal(parsed.usedPercent, undefined)
})

test('fails closed on bad JSON and non-object bodies', () => {
  assert.equal(parseBillingCreditsJson('{not-json').status, 'unavailable')
  assert.equal(parseBillingCredits(null).status, 'unavailable')
  assert.equal(parseBillingCredits([]).status, 'unavailable')
  assert.equal(parseBillingCredits('nope').status, 'unavailable')
})

test('fetchBillingUsage never invents percentages on HTTP/network failure', async () => {
  const unauthorized = await fetchBillingUsage('token', {
    fetch: async () => new Response('{"creditUsagePercent":99}', { status: 401 }),
  })
  assert.equal(unauthorized.status, 'unavailable')
  assert.equal(unauthorized.usedPercent, undefined)
  assert.match(unauthorized.reason, /401/)

  const network = await fetchBillingUsage('token', {
    fetch: async () => {
      throw new Error('ECONNRESET')
    },
  })
  assert.equal(network.status, 'unavailable')
  assert.equal(network.usedPercent, undefined)

  const ok = await fetchBillingUsage('token', {
    fetch: async () => new Response(JSON.stringify({
      config: {
        creditUsagePercent: 12,
        currentPeriod: { end: '2026-09-29T00:00:00.000Z' },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  })
  assert.equal(ok.status, 'ok')
  assert.equal(ok.usedPercent, 12)
  assert.equal(ok.remainingPercent, 88)
  assert.equal(typeof ok.fetchedAt, 'string')
})

test('fetchBillingUsage without a token is unavailable', async () => {
  const result = await fetchBillingUsage('')
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /signed in/i)
})


test('empty object missing percent explains empty object', () => {
  const parsed = parseBillingCredits({})
  assert.equal(parsed.status, 'unavailable')
  assert.match(parsed.reason, /creditUsagePercent/i)
  assert.match(parsed.reason, /empty object/i)
  assert.equal(parsed.usedPercent, undefined)
})

test('fetchBillingUsage hard-timeouts even if fetch never settles', async () => {
  const started = Date.now()
  const result = await fetchBillingUsage('token', {
    timeoutMs: 50,
    fetch: () => new Promise(() => {
      // Intentionally never resolves (AbortSignal alone would not help).
    }),
  })
  const elapsed = Date.now() - started
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /timed out/i)
  assert.equal(result.usedPercent, undefined)
  assert.ok(elapsed < 400, `expected hard race timeout, took ${elapsed}ms`)
})

test('fetchBillingUsage surfaces non-JSON Content-Type', async () => {
  const result = await fetchBillingUsage('token', {
    fetch: async () => new Response('<html>nope</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
  })
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /Content-Type/i)
  assert.match(result.reason, /text\/html/i)
  assert.equal(result.usedPercent, undefined)
})

test('fetchBillingUsage accepts JSON body despite wrong Content-Type when parseable', async () => {
  const result = await fetchBillingUsage('token', {
    fetch: async () => new Response(JSON.stringify({
      config: { creditUsagePercent: 5 },
    }), {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }),
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.usedPercent, 5)
})

/**
 * Live shape observed 2026-09-29 for a signed-in account whose weekly period
 * rolled over: `config` carries prepaid balance and an on-demand cap, and no
 * credit percentage at all. Captured verbatim (values included) so a reader
 * that "helpfully" derives a percent from these fields fails here.
 */
const UNIFIED_BILLING_BODY = Object.freeze({
  config: {
    currentPeriod: {
      type: 'USAGE_PERIOD_TYPE_WEEKLY',
      start: '2026-09-28T16:46:29.886619+00:00',
      end: '2026-10-05T16:46:29.886619+00:00',
    },
    onDemandCap: { val: 0 },
    onDemandUsed: { val: 0 },
    isUnifiedBillingUser: true,
    prepaidBalance: { val: 0 },
    topUpMethod: 'TOP_UP_METHOD_SAVED_PAYMENT_METHOD',
    billingPeriodStart: '2026-09-28T16:46:29.886619+00:00',
    billingPeriodEnd: '2026-10-05T16:46:29.886619+00:00',
  },
})

const DURING_UNIFIED_PERIOD = Date.parse('2026-09-29T12:00:00.000Z')
const BEFORE_UNIFIED_PERIOD = Date.parse('2026-09-28T00:00:00.000Z')

test('an active weekly window with no percentage reads as the omitted proto3 zero', () => {
  const parsed = parseBillingCredits(UNIFIED_BILLING_BODY, { now: DURING_UNIFIED_PERIOD })

  assert.equal(parsed.status, 'ok')
  assert.equal(parsed.usedPercent, 0)
  assert.equal(parsed.remainingPercent, 100)
  assert.equal(parsed.percentSource, 'omitted-zero')
  assert.equal(parsed.periodStart, '2026-09-28T16:46:29.886Z')
  assert.equal(parsed.periodEnd, '2026-10-05T16:46:29.886Z')
})

test('the same body stays unavailable once the window no longer contains now', () => {
  const parsed = parseBillingCredits(UNIFIED_BILLING_BODY, { now: BEFORE_UNIFIED_PERIOD })

  assert.equal(parsed.status, 'unavailable')
  assert.equal(parsed.code, 'unified-billing')
  assert.match(parsed.reason, /unified billing/i)
  assert.equal(parsed.usedPercent, undefined)
  assert.equal(parsed.remainingPercent, undefined)
  assert.equal(parsed.percentSource, undefined)
  assert.equal(parsed.periodStart, '2026-09-28T16:46:29.886Z')
  assert.equal(parsed.periodEnd, '2026-10-05T16:46:29.886Z')
})

test('prepaid and on-demand zeros are not a percentage without an active window', () => {
  const parsed = parseBillingCredits({
    config: {
      isUnifiedBillingUser: true,
      prepaidBalance: { val: 0 },
      onDemandCap: { val: 0 },
      billingPeriodStart: '2026-09-28T16:46:29.886619+00:00',
      billingPeriodEnd: '2026-10-05T16:46:29.886619+00:00',
    },
  }, { now: DURING_UNIFIED_PERIOD })

  assert.equal(parsed.status, 'unavailable')
  assert.equal(parsed.usedPercent, undefined)
})

test('a product percentage blocks the omitted-zero reading', () => {
  const parsed = parseBillingCredits({
    config: {
      ...UNIFIED_BILLING_BODY.config,
      productUsage: [{ product: 'GrokBuild', usagePercent: 4 }],
    },
  }, { now: DURING_UNIFIED_PERIOD })

  assert.equal(parsed.status, 'unavailable')
  assert.equal(parsed.usedPercent, undefined)
})

test('an explicit zero is not marked as an omitted field', () => {
  const parsed = parseBillingCredits({
    config: {
      ...UNIFIED_BILLING_BODY.config,
      creditUsagePercent: 0,
    },
  }, { now: DURING_UNIFIED_PERIOD })

  assert.equal(parsed.status, 'ok')
  assert.equal(parsed.usedPercent, 0)
  assert.equal(parsed.remainingPercent, 100)
  assert.equal(parsed.percentSource, undefined)
})

test('a daily period does not adopt an omitted percentage', () => {
  const parsed = parseBillingCredits({
    config: {
      currentPeriod: {
        type: 'USAGE_PERIOD_TYPE_DAILY',
        start: '2026-09-29T00:00:00.000Z',
        end: '2026-09-30T00:00:00.000Z',
      },
    },
  }, { now: DURING_UNIFIED_PERIOD })

  assert.equal(parsed.status, 'unavailable')
  assert.equal(parsed.percentSource, undefined)
})

test('an unknown shape keeps the diagnostic listing of top-level keys', () => {
  const parsed = parseBillingCredits({ config: { currentPeriod: { end: '2026-09-22T00:00:00.000Z' } } })

  assert.equal(parsed.status, 'unavailable')
  assert.equal(parsed.code, 'missing-percent')
  assert.match(parsed.reason, /keys:\s*config/i)
  assert.equal(parsed.periodEnd, '2026-09-22T00:00:00.000Z', 'the window is still reported')
})
