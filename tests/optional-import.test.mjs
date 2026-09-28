import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optionalImport } from '../src/adapter.js'

function neverResolves() {
  return new Promise(() => {
    // Intentionally never resolves.
  })
}

test('optionalImport returns undefined when importFn never settles (timeout)', async () => {
  const started = Date.now()
  const mod = await optionalImport('fake-hanging-module', {
    timeoutMs: 40,
    importFn: () => neverResolves(),
  })
  const elapsed = Date.now() - started
  assert.equal(mod, undefined)
  assert.ok(elapsed < 200, `optionalImport should time out quickly, took ${elapsed}ms`)
})

test('optionalImport returns undefined when importFn throws', async () => {
  const mod = await optionalImport('missing-module', {
    timeoutMs: 100,
    importFn: async () => {
      throw new Error('not found')
    },
  })
  assert.equal(mod, undefined)
})

test('optionalImport returns the module when importFn resolves', async () => {
  const mod = await optionalImport('ok-module', {
    timeoutMs: 100,
    importFn: async () => ({ ok: true }),
  })
  assert.deepEqual(mod, { ok: true })
})
