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
