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
