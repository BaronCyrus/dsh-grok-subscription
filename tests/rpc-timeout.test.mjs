import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRpcHandler } from '../src/rpc.js'

function neverResolves() {
  return new Promise(() => {})
}

test('RPC handler returns publicError when session.status never settles', async () => {
  const handler = createRpcHandler({
    status: async () => neverResolves(),
  }, { timeoutMs: 40 })

  const started = Date.now()
  const result = await handler('status', {}, undefined)
  const elapsed = Date.now() - started

  assert.equal(result.ok, false)
  assert.match(result.error.message, /timed out/i)
  assert.ok(elapsed < 200, `expected host timeout quickly, took ${elapsed}ms`)
})

test('RPC handler returns publicError when pull never settles', async () => {
  const handler = createRpcHandler({
    pull: async () => neverResolves(),
  }, { timeoutMs: 40 })

  const result = await handler('pull', {}, undefined)
  assert.equal(result.ok, false)
  assert.match(result.error.message, /timed out/i)
})
