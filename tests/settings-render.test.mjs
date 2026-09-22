import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { en, zh } from '../src/locales.js'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

/**
 * Loads the built client bundle the way DSH's browser module loader does: the
 * bundle registers a factory, and `require` inside it resolves the host's
 * externals. Rendering the real component catches crashes that a hand-written
 * markup mock cannot — an unguarded property access shipped once and blanked
 * the whole Settings panel.
 */
function loadPanel() {
  const bundle = new URL('../lib/client.js', import.meta.url)
  let registration
  globalThis.window = { __ModuleLoader__: { load: definition => { registration = definition } } }
  try {
    delete require.cache[bundle.pathname]
    require(bundle.pathname)
    assert.ok(registration, 'client bundle must register with the module loader')
    return registration.factory(id => {
      if (id === 'react') return React
      if (id === 'react-dom') return require('react-dom')
      if (id === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (id === 'react-dom/client') return require('react-dom/client')
      return undefined
    })
  } finally {
    delete globalThis.window
  }
}

const panel = loadPanel()
const t = key => `«${key}»`

function render(status) {
  const rpc = { call: async () => ({ ok: true, value: status }) }
  return renderToStaticMarkup(React.createElement(panel.GrokSubscriptionPanel, { rpc, t }))
}

const SIGNED_IN = {
  account: { signedIn: true, maskedAccount: 'a***2@gmail.com' },
  catalog: {
    source: 'live',
    models: [{ id: 'grok-4.7', name: 'Grok 4.7' }, { id: 'grok-4.6', name: 'Grok 4.6' }],
  },
  usage: {
    status: 'ok',
    usedPercent: 6,
    remainingPercent: 94,
    periodEndLocal: '9/29, 12:46 AM',
    periodEnd: '2026-09-29T00:46:00Z',
    productUsage: [{ name: 'Grok Build', usedPercent: 6 }],
    fetchedAt: '2026-09-22 14:03',
  },
  cliAvailable: true,
}

// The first paint after opening the section has no status yet; this is exactly
// the state that used to throw and blank the panel.
test('renders on first paint with no status loaded yet', () => {
  const html = render(undefined)
  assert.match(html, /grokSubscription/)
  assert.match(html, /«title»/)
})

test('renders every status shape without throwing', () => {
  const shapes = [
    undefined,
    {},
    { account: { signedIn: false }, catalog: { source: 'signed-out', models: [] } },
    { usage: {} },
    { usage: { status: 'ok' } },
    { usage: { status: 'unavailable', reason: 'boom' } },
    { usage: { status: 'ok', usedPercent: 6 } },
    { usage: { status: 'ok', remainingPercent: 94 } },
    { usage: { status: 'ok', usedPercent: 6, remainingPercent: 94, productUsage: [] } },
    { usage: { status: 'ok', usedPercent: 6, productUsage: [{ name: 'x' }] } },
    { account: { signedIn: true }, catalog: { source: 'fallback', models: [{ id: 'grok-4.7' }], error: 'catalog down' } },
    { account: { signedIn: true }, cliAvailable: false },
    SIGNED_IN,
  ]
  for (const shape of shapes) {
    assert.doesNotThrow(() => render(shape), `shape ${JSON.stringify(shape)} must render`)
  }
})

test('first paint renders the section shell with cards and the disclosure', () => {
  const html = render(undefined)
  assert.match(html, /class="gsHead"/)
  assert.match(html, /gsCard/)
  assert.match(html, /gsDisclosure/)
  assert.match(html, /«loginCli»/)
  assert.match(html, /«logout»/)
})

// React 18 applies error boundaries only in the streaming renderer, and driving
// that here leaves the test runner hanging, so the fallback is rendered directly
// from the boundary's own state. Routing real errors into it is React's contract.
test('a crashing child degrades to a readable card instead of a blank panel', () => {
  const instance = new panel.SectionBoundary({ t, children: React.createElement('div', null, 'ok') })
  assert.ok(instance.render(), 'boundary renders children while healthy')

  instance.state = { error: new Error('kaboom') }
  const html = renderToStaticMarkup(instance.render())
  assert.match(html, /«renderError»/, 'boundary must show the localised failure label')
  assert.match(html, /kaboom/, 'boundary must surface the underlying message')
  assert.match(html, /gsCard/, 'boundary fallback must still be a styled card')
  assert.match(html, /«title»/, 'boundary fallback must keep the section heading')
  assert.doesNotMatch(html, /<section class="grokSubscription"><\/section>/, 'must not render an empty panel')
})

test('the boundary reports the first error it sees via getDerivedStateFromError', () => {
  const error = new Error('boom')
  assert.deepEqual(panel.SectionBoundary.getDerivedStateFromError(error), { error })
})

function renderUsage(usage, extra = {}) {
  return renderToStaticMarkup(React.createElement(panel.UsagePanel, {
    usage,
    t,
    usageBusy: false,
    signedIn: extra.signedIn ?? true,
    onRefresh: () => {},
  }))
}

// `status` only arrives from an effect, so the panel itself always renders the
// "not loaded yet" state under SSR. The usage card takes its data as a prop, so
// it can be exercised directly for every backend shape.
test('usage card renders the gauge and bar for reported percentages', () => {
  const html = renderUsage(SIGNED_IN.usage)
  assert.match(html, /class="gsGaugeValue">94%/)
  assert.match(html, /style="width:94%"/)
  assert.match(html, /class="gsRow"/)
  assert.match(html, /Grok Build/)
})

test('usage card derives remaining from used when only used is reported', () => {
  const html = renderUsage({ status: 'ok', usedPercent: 25 })
  assert.match(html, /class="gsGaugeValue">75%/)
  assert.match(html, /style="width:75%"/)
})

test('usage card survives every partial and hostile payload', () => {
  const shapes = [
    undefined, {}, { status: 'ok' }, { status: 'ok', usedPercent: 6 },
    { status: 'ok', remainingPercent: 94 }, { status: 'ok', usedPercent: null },
    { status: 'ok', remainingPercent: 'nope' }, { status: 'ok', productUsage: null },
    { status: 'ok', productUsage: [] }, { status: 'ok', productUsage: [{}] },
    { status: 'ok', usedPercent: 6, productUsage: [{}] },
    { status: 'ok', usedPercent: 200 }, { status: 'ok', usedPercent: -5 },
    { status: 'ok', remainingPercent: 150 }, { status: 'unavailable', reason: 'nope' },
    { status: 'ok', periodEnd: 'x', periodEndLocal: 'y', fetchedAt: 'z' },
  ]
  for (const shape of shapes) {
    assert.doesNotThrow(() => renderUsage(shape), `usage ${JSON.stringify(shape)} must render`)
  }
})

test('gauge width stays within 0-100 for out-of-range values', () => {
  assert.match(renderUsage({ status: 'ok', remainingPercent: 150 }), /style="width:100%"/)
  assert.match(renderUsage({ status: 'ok', remainingPercent: -20 }), /style="width:0%"/)
})

test('diagnostics rows report the active adapter and image capability', () => {
  const render2 = diagnostics => renderToStaticMarkup(
    React.createElement(panel.DiagnosticsRows, { diagnostics, t }),
  )
  assert.equal(render2(undefined), '', 'nothing is shown when the host sends no diagnostics')

  const piAi = render2({ adapter: 'pi-ai', imageInput: true })
  assert.match(piAi, /«adapterPiAi»/)
  assert.match(piAi, /«imageInputOn»/)

  const fallback = render2({ adapter: 'fallback', imageInput: false })
  assert.match(fallback, /«adapterFallback»/)
  assert.match(fallback, /«imageInputOff»/, 'the capability row must be honest about the fallback')

  // Missing or unexpected shapes must not crash the panel.
  for (const shape of [{}, { adapter: 'unknown' }, { imageInput: true }, { adapter: null, imageInput: null }]) {
    assert.doesNotThrow(() => render2(shape), `diagnostics ${JSON.stringify(shape)} must render`)
  }
})

test('both locales are reachable from the panel copy', () => {
  assert.ok(zh.renderError && en.renderError)
  assert.ok(zh.refreshCatalog && en.refreshCatalog)
  assert.ok(zh.loginHelp && en.loginHelp)
  assert.ok(zh.diagnostics && en.diagnostics)
  assert.ok(zh.imageInput && en.imageInput)
  assert.ok(zh.adapterHint && en.adapterHint)
})

test('the shipped bundle is not stale relative to src', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(bundle, /gsCard/, 'lib/client.js must contain the current panel markup')
  assert.match(bundle, /gsDisclosure/)
  assert.match(bundle, /renderError/)
})