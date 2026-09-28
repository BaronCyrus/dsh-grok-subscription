import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visiblePiModels } from '../src/adapter.js'
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

// The models the host's PiAiAdapter lists come from provider.getModels(), which
// this function backs on every call.
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
  assert.deepEqual(models[0].thinkingLevelMap && Object.keys(models[0].thinkingLevelMap), [
    'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
  ])
})
