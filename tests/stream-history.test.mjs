import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDuckAdapter,
  responsesInput,
  streamResponses,
  withEncryptedReasoningInclude,
} from '../src/adapter.js'
import { PROVIDER_ID } from '../src/constants.js'

function sse(events) {
  return events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n'
}

async function collect(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

test('duck stream block-end keeps accumulated assistant text (multi-turn render fix)', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response(sse([
    { type: 'response.reasoning_text.delta', delta: 'plan' },
    { type: 'response.output_text.delta', delta: 'Hello' },
    { type: 'response.output_text.delta', delta: ' world' },
    {
      type: 'response.completed',
      response: { status: 'completed', usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } },
    },
  ]), { status: 200, headers: { 'content-type': 'text/event-stream' } })

  try {
    const chunks = await collect(streamResponses({
      provider: PROVIDER_ID,
      model: 'grok-4.7',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    }, 'test-token'))

    const reasoningEnd = chunks.find(chunk => chunk.type === 'block-end' && chunk.block?.type === 'reasoning')
    const textEnd = chunks.find(chunk => chunk.type === 'block-end' && chunk.block?.type === 'text')
    assert.equal(reasoningEnd?.block?.text, 'plan')
    assert.equal(textEnd?.block?.text, 'Hello world')
    assert.ok(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'Hello'))
    assert.ok(chunks.some(chunk => chunk.type === 'finish' && chunk.reason?.kind === 'stop'))
  } finally {
    globalThis.fetch = previous
  }
})

test('duck stream requests encrypted reasoning when effort is set', async () => {
  const previous = globalThis.fetch
  let body
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body)
    return new Response(sse([
      { type: 'response.output_text.delta', delta: 'ok' },
      { type: 'response.completed', response: { status: 'completed' } },
    ]), { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  try {
    await collect(streamResponses({
      provider: PROVIDER_ID,
      model: 'grok-4.7',
      reasoningEffort: 'high',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    }, 'test-token'))
    assert.deepEqual(body.include, ['reasoning.encrypted_content'])
    assert.deepEqual(body.reasoning, { effort: 'high' })
  } finally {
    globalThis.fetch = previous
  }
})

test('responsesInput skips empty assistant turns left by older builds', () => {
  const input = responsesInput({
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'one' }] },
      { role: 'assistant', content: [{ type: 'text', text: '' }, { type: 'reasoning', text: 'gone' }] },
      { role: 'user', content: [{ type: 'text', text: 'two' }] },
    ],
  })
  assert.deepEqual(input, [
    { role: 'user', content: 'one' },
    { role: 'user', content: 'two' },
  ])
})

test('withEncryptedReasoningInclude injects include for pi-ai stream options', () => {
  const seen = []
  const api = {
    stream(_model, _context, options) {
      seen.push(options)
      return { async *[Symbol.asyncIterator]() {} }
    },
    streamSimple(_model, _context, options) {
      seen.push(options)
      return { async *[Symbol.asyncIterator]() {} }
    },
  }
  const wrapped = withEncryptedReasoningInclude(api)
  wrapped.stream({}, {}, { samplingParams: { temperature: 0.2 } })
  wrapped.streamSimple({}, {}, {})
  assert.deepEqual(seen[0].samplingParams.include, ['reasoning.encrypted_content'])
  assert.equal(seen[0].samplingParams.temperature, 0.2)
  assert.deepEqual(seen[1].samplingParams.include, ['reasoning.encrypted_content'])
})

test('duck listModels still gates on signed-in session', async () => {
  const duck = createDuckAdapter({
    publicAccount: () => ({ signedIn: true }),
    models: () => [{ id: 'grok-4.7', name: 'Grok 4.7', contextWindow: 500_000, maxTokens: 500_000, reasoning: true }],
    currentToken: async () => 'tok',
    logout: async () => {},
  })
  const listed = await duck.listModels(PROVIDER_ID)
  assert.equal(listed[0].id, 'grok-4.7')
})
