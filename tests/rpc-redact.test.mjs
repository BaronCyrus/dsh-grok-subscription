import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRpcHandler } from '../src/rpc.js'

test('status RPC never returns tokens to the browser', async () => {
  const handler = createRpcHandler({
    status: async () => ({
      account: { signedIn: true, maskedAccount: 'a•••e@example.com', accessToken: 'SHOULD-NOT-LEAK' },
      catalog: { source: 'live', models: [{ id: 'grok-4.7', name: 'Grok 4.7', key: 'nope' }] },
      token: 'nope',
    }),
  })
  const result = await handler('status', {}, undefined)
  assert.equal(result.ok, true)
  assert.equal(result.value.account.accessToken, undefined)
  assert.equal(result.value.token, undefined)
  assert.equal(result.value.catalog.models[0].key, undefined)
  assert.equal(result.value.catalog.models[0].id, 'grok-4.7')
})

test('status RPC carries adapter diagnostics without leaking secrets', async () => {
  const handler = createRpcHandler({
    status: async () => ({
      account: { signedIn: true, maskedAccount: 'a•••e@example.com' },
      catalog: { source: 'live', models: [] },
      accessToken: 'SHOULD-NOT-LEAK',
    }),
  }, {
    diagnostics: () => ({
      adapter: 'fallback',
      adapterKind: 'custom-mvp',
      imageInput: true,
      hostPeersResolved: false,
    }),
  })
  const result = await handler('status', {}, undefined)
  assert.equal(result.ok, true)
  assert.deepEqual(result.value.diagnostics, {
    adapter: 'fallback',
    adapterKind: 'custom-mvp',
    imageInput: true,
    hostPeersResolved: false,
  })
  assert.equal(result.value.accessToken, undefined)
})

test('status RPC omits diagnostics when the plugin supplies none', async () => {
  const handler = createRpcHandler({
    status: async () => ({ account: { signedIn: false }, catalog: { source: 'signed-out', models: [] } }),
  })
  const result = await handler('status', {}, undefined)
  assert.equal(result.ok, true)
  assert.equal(result.value.diagnostics, undefined)
})

test('usage RPC never returns tokens and sanitizes usage', async () => {
  const handler = createRpcHandler({
    usage: () => ({
      status: 'ok',
      usedPercent: 10,
      remainingPercent: 90,
      accessToken: 'LEAK',
      token: 'LEAK',
    }),
    publicAccount: () => ({ signedIn: true, maskedAccount: 'a•••e', accessToken: 'LEAK' }),
    refreshUsage: async () => ({
      status: 'ok',
      usedPercent: 11,
      remainingPercent: 89,
      accessToken: 'LEAK2',
    }),
  })
  const cached = await handler('usage', {}, undefined)
  assert.equal(cached.ok, true)
  assert.equal(cached.value.usage.usedPercent, 10)
  assert.equal(cached.value.usage.accessToken, undefined)
  assert.equal(cached.value.usage.token, undefined)

  const refreshed = await handler('usage/refresh', {}, undefined)
  assert.equal(refreshed.ok, true)
  assert.equal(refreshed.value.usage.usedPercent, 11)
  assert.equal(refreshed.value.usage.accessToken, undefined)
  assert.equal(refreshed.value.account.accessToken, undefined)
})

test('catalog/refresh RPC returns stripSecrets catalog+account+usage (no tokens)', async () => {
  const handler = createRpcHandler({
    refreshCatalog: async () => ({
      source: 'live',
      models: [{ id: 'grok-4.7', name: 'Grok 4.7', key: 'nope' }],
      accessToken: 'LEAK',
    }),
    publicAccount: () => ({ signedIn: true, maskedAccount: 'a•••e', accessToken: 'LEAK' }),
    usage: () => ({
      status: 'ok',
      usedPercent: 2,
      remainingPercent: 98,
      token: 'LEAK',
    }),
  })
  const result = await handler('catalog/refresh', {}, undefined)
  assert.equal(result.ok, true)
  assert.equal(result.value.catalog.source, 'live')
  assert.equal(result.value.catalog.models[0].id, 'grok-4.7')
  assert.equal(result.value.catalog.models[0].key, undefined)
  assert.equal(result.value.catalog.accessToken, undefined)
  assert.equal(result.value.account.accessToken, undefined)
  assert.equal(result.value.usage.usedPercent, 2)
  assert.equal(result.value.usage.token, undefined)
})
