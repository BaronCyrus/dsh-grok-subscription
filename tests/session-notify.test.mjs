import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionService } from '../src/session.js'

function waitDeferred() {
  return new Promise(resolve => {
    if (typeof setImmediate === 'function') setImmediate(resolve)
    else queueMicrotask(resolve)
  })
}

test('logout notifies catalog change callback', async () => {
  let calls = 0
  const credentials = {
    resolve: async () => ({ value: 'stored-token' }),
    set: async () => {},
    unset: async () => {},
  }
  const session = createSessionService({
    credentials,
    onCatalogChange: () => {
      calls += 1
    },
  })
  const result = await session.logout()
  assert.equal(result.ok, true)
  assert.equal(session.publicAccount().signedIn, false)
  await waitDeferred()
  assert.equal(calls, 1)
})

test('refreshCatalog notifies even when signed out', async () => {
  let calls = 0
  const session = createSessionService({
    credentials: {
      resolve: async () => undefined,
    },
    onCatalogChange: () => {
      calls += 1
    },
  })
  const catalog = await session.refreshCatalog()
  assert.equal(catalog.source, 'signed-out')
  await waitDeferred()
  assert.equal(calls, 1)
})

test('onCatalogChange errors are swallowed (do not break logout)', async () => {
  const session = createSessionService({
    credentials: {
      resolve: async () => ({ value: 'stored-token' }),
      unset: async () => {},
    },
    logger: { warn() {} },
    onCatalogChange: () => {
      throw new Error('listener failed')
    },
  })
  const result = await session.logout()
  assert.equal(result.ok, true)
  await waitDeferred()
})
