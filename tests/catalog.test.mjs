import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractLiveModels, extractModelIds, fallbackModels, mergeCatalog, reasoningInfoOf, toLlmModels } from '../src/catalog.js'

test('parses OpenAI-style { data } listings including grok-4.7', () => {
  const models = extractLiveModels({
    data: [
      { id: 'grok-4.7', name: 'Grok 4.7', context_window: 500000, reasoning_efforts: ['low', 'medium', 'high', 'xhigh'] },
      { id: 'grok-4.6', reasoning_efforts: ['low', 'high'] },
    ],
  })
  assert.deepEqual(extractModelIds({ data: models }), ['grok-4.7', 'grok-4.6'])
  assert.equal(models[0].name, 'Grok 4.7')
  assert.equal(models[0].contextWindow, 500000)
  assert.deepEqual(models[0].reasoningEfforts, ['low', 'medium', 'high', 'xhigh'])
})

test('parses a bare array and a { models } envelope', () => {
  assert.deepEqual(extractModelIds(['grok-4.7', { id: 'grok-4.5' }]), ['grok-4.7', 'grok-4.5'])
  assert.deepEqual(extractModelIds({ models: [{ model: 'grok-4.7' }] }), ['grok-4.7'])
})

test('uses the static fallback, including grok-4.7, when live listing is empty', () => {
  const merged = mergeCatalog([])
  assert.ok(merged.some(model => model.id === 'grok-4.7'))
  assert.equal(merged[0].source, 'fallback')
  assert.ok(fallbackModels().some(model => model.id === 'grok-4.7'))
})

test('keeps live models and marks them live when the catalog is non-empty', () => {
  const merged = mergeCatalog(extractLiveModels({ data: [{ id: 'grok-4.7' }] }))
  assert.equal(merged.length, 1)
  assert.equal(merged[0].source, 'live')
  assert.equal(merged[0].id, 'grok-4.7')
})

test('reasoningInfoOf defaults efforts and prefers high', () => {
  const info = reasoningInfoOf({ reasoning: true })
  assert.deepEqual(info.efforts.map(item => item.id), ['low', 'medium', 'high', 'xhigh'])
  assert.equal(info.defaultEffort, 'high')
  assert.equal(reasoningInfoOf({ reasoning: false }), undefined)
  assert.equal(reasoningInfoOf({ reasoningEfforts: ['low', 'medium'], defaultEffort: 'low' }).defaultEffort, 'low')
})

test('toLlmModels attaches reasoning efforts for fallback and sample models', () => {
  const fallback = toLlmModels(fallbackModels())
  assert.ok(fallback.length > 0)
  for (const model of fallback) {
    assert.ok(model.reasoning)
    assert.ok(model.reasoning.efforts.some(item => item.id === 'high'))
    assert.equal(model.reasoning.defaultEffort, 'high')
  }
  const sample = toLlmModels([{
    id: 'grok-4.7',
    name: 'Grok 4.7',
    reasoning: true,
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
  }])
  assert.deepEqual(sample[0].reasoning.efforts.map(item => item.id), ['low', 'medium', 'high', 'xhigh'])
  assert.equal(sample[0].reasoning.defaultEffort, 'high')
})

test('fallbackModels sets defaultEffort high', () => {
  for (const model of fallbackModels()) {
    assert.equal(model.defaultEffort, 'high')
    assert.ok(Array.isArray(model.reasoningEfforts) && model.reasoningEfforts.length)
  }
})

