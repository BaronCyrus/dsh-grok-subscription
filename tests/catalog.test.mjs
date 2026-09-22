import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractLiveModels, extractModelIds, fallbackModels, mergeCatalog } from '../src/catalog.js'

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
