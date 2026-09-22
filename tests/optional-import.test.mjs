import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optionalImport, createGrokBuildAdapterSync, createDuckHostAdapter } from '../src/adapter.js'
import { PROVIDER_ID } from '../src/constants.js'

function neverResolves() {
  return new Promise(() => {
    // Intentionally never resolves.
  })
}

function fakeSession({ signedIn = false, models = [] } = {}) {
  return {
    publicAccount: () => ({ signedIn }),
    models: () => models,
    currentToken: async () => (signedIn ? 'token' : undefined),
    logout: async () => {},
  }
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

test('createGrokBuildAdapterSync / createDuckHostAdapter need no dynamic imports', async () => {
  const session = fakeSession({ signedIn: true, models: [{ id: 'grok-4.7', name: 'Grok 4.7' }] })
  const sync = createGrokBuildAdapterSync(session)
  assert.equal(sync.kind, 'custom-mvp')
  assert.ok(sync.adapter)
  const listed = await sync.adapter.listModels(PROVIDER_ID)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, 'grok-4.7')

  const alias = createDuckHostAdapter(session)
  assert.equal(alias.kind, 'custom-mvp')
  assert.deepEqual(await alias.adapter.listModels(PROVIDER_ID), listed)
})
