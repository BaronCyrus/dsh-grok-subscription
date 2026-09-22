import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamResponses } from '../src/adapter.js'

const encoder = new TextEncoder()

function sseResponse(frames) {
  const text = frames.map(frame => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join('')
  return new Response(new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode(text)); controller.close() },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

async function usageFrom(frames) {
  const original = globalThis.fetch
  globalThis.fetch = async () => sseResponse(frames)
  try {
    let usage
    for await (const chunk of streamResponses({
      model: 'grok-4.7',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    }, 'test-token')) {
      if (chunk.type === 'usage') usage = chunk.usage
    }
    return usage
  } finally {
    globalThis.fetch = original
  }
}

const completed = usage => ({
  type: 'response.completed',
  response: { status: 'completed', output: [], usage },
})

test('cache hits are reported and removed from the uncached input count', async () => {
  // Shape captured from cli-chat-proxy: input_tokens includes the cached share.
  const usage = await usageFrom([completed({
    input_tokens: 12457,
    input_tokens_details: { cached_tokens: 12416 },
    output_tokens: 73,
    output_tokens_details: { reasoning_tokens: 72 },
    total_tokens: 12530,
  })])
  assert.equal(usage.cacheReadTokens, 12416, 'the host shows cache-hit percentage from this')
  assert.equal(usage.inputTokens, 41, 'uncached input only: 12457 - 12416')
  assert.equal(usage.outputTokens, 73)
  assert.equal(usage.totalTokens, 12530)
  assert.equal(usage.reasoningTokens, 72)
  assert.equal(
    usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    12457,
    'billed input must reconstruct the provider prompt total',
  )
})

test('a cold call reports zero cached tokens without going negative', async () => {
  const usage = await usageFrom([completed({
    input_tokens: 9396,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: 315,
    total_tokens: 9711,
  })])
  assert.equal(usage.cacheReadTokens, 0)
  assert.equal(usage.inputTokens, 9396)
})

test('cache-write tokens are separated as well', async () => {
  const usage = await usageFrom([completed({
    input_tokens: 1000,
    input_tokens_details: { cached_tokens: 400, cache_write_tokens: 100 },
    output_tokens: 10,
    total_tokens: 1010,
  })])
  assert.equal(usage.cacheReadTokens, 400)
  assert.equal(usage.cacheWriteTokens, 100)
  assert.equal(usage.inputTokens, 500)
})

test('a provider that folds more cache than it reports never yields negative input', async () => {
  const usage = await usageFrom([completed({
    input_tokens: 100,
    input_tokens_details: { cached_tokens: 250 },
    output_tokens: 5,
  })])
  assert.equal(usage.inputTokens, 0)
  assert.equal(usage.cacheReadTokens, 250)
})

test('missing or malformed detail blocks keep the plain totals', async () => {
  const plain = await usageFrom([completed({ input_tokens: 50, output_tokens: 7 })])
  assert.equal(plain.inputTokens, 50)
  assert.equal(plain.cacheReadTokens, 0)
  assert.equal(plain.totalTokens, 57)

  const junk = await usageFrom([completed({
    input_tokens: 50,
    input_tokens_details: { cached_tokens: 'nope' },
    output_tokens: 7,
  })])
  assert.equal(junk.inputTokens, 50)
  assert.equal(junk.cacheReadTokens, 0)
})

test('prompt_tokens/completion_tokens fallbacks still work', async () => {
  const usage = await usageFrom([completed({
    prompt_tokens: 200,
    prompt_tokens_details: { cached_tokens: 50 },
    completion_tokens: 20,
  })])
  assert.equal(usage.inputTokens, 150)
  assert.equal(usage.cacheReadTokens, 50)
  assert.equal(usage.outputTokens, 20)
  assert.equal(usage.totalTokens, 220)
})
