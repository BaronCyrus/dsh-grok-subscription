import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visiblePiModels, createDuckAdapter } from '../src/adapter.js'
import { PROVIDER_ID } from '../src/constants.js'

function fakeSession({ signedIn = false, models = [] } = {}) {
  return {
    publicAccount: () => ({ signedIn }),
    models: () => models,
    currentToken: async () => (signedIn ? 'token' : undefined),
    logout: async () => {},
  }
}

const sample = Object.freeze({
  id: 'grok-4.7',
  name: 'Grok 4.7',
  contextWindow: 500_000,
  maxTokens: 500_000,
  reasoning: true,
  reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
  source: 'live',
})

test('visiblePiModels is empty when signed out (fail-closed)', () => {
  const models = visiblePiModels(fakeSession({
    signedIn: false,
    models: [sample],
  }))
  assert.deepEqual(models, [])
})

test('visiblePiModels returns grok-build models when signed in', () => {
  const models = visiblePiModels(fakeSession({
    signedIn: true,
    models: [sample],
  }))
  assert.equal(models.length, 1)
  assert.equal(models[0].id, 'grok-4.7')
  assert.equal(models[0].provider, PROVIDER_ID)
})

test('duck listModels follows session.models and signed-in gate', async () => {
  const session = fakeSession({ signedIn: true, models: [sample] })
  const duck = createDuckAdapter(session)
  const listed = await duck.listModels(PROVIDER_ID)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, 'grok-4.7')
  assert.equal(listed[0].provider, PROVIDER_ID)

  const signedOut = createDuckAdapter(fakeSession({ signedIn: false, models: [sample] }))
  assert.deepEqual(await signedOut.listModels(PROVIDER_ID), [])
})

test('duck listModels and resolveModel expose reasoning efforts for signed-in sample', async () => {
  const session = fakeSession({ signedIn: true, models: [sample] })
  const duck = createDuckAdapter(session)
  const listed = await duck.listModels(PROVIDER_ID)
  assert.equal(listed.length, 1)
  const effortIds = listed[0].reasoning.efforts.map(item => item.id)
  assert.deepEqual(effortIds, ['low', 'medium', 'high', 'xhigh'])
  assert.ok(listed[0].reasoning.defaultEffort)

  const resolved = await duck.resolveModel(PROVIDER_ID, 'grok-4.7')
  const resolvedIds = resolved.reasoning.efforts.map(item => item.id)
  assert.ok(resolvedIds.includes('low'))
  assert.ok(resolvedIds.includes('medium'))
  assert.ok(resolvedIds.includes('high'))
  assert.ok(resolvedIds.includes('xhigh'))
  assert.ok(resolved.reasoning.defaultEffort)
  assert.equal(resolved.context.contextWindow, 500_000)
})

