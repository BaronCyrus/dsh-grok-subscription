import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamResponses } from '../src/adapter.js'

const encoder = new TextEncoder()

function sseResponse(frames) {
  const text = frames.map(frame => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join('')
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

async function collect(frames) {
  const original = globalThis.fetch
  globalThis.fetch = async () => sseResponse(frames)
  try {
    const chunks = []
    for await (const chunk of streamResponses({
      model: 'grok-4.7',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'run pwd' }] }],
    }, 'test-token')) {
      chunks.push(chunk)
    }
    return chunks
  } finally {
    globalThis.fetch = original
  }
}

/**
 * Mirrors the host's lossless-JSON rule: DSH aborts the whole turn when a
 * stream chunk contains undefined, a non-finite number, or a class instance.
 */
function assertLosslessJson(value, path = '$') {
  if (value === null) return
  const type = typeof value
  if (type === 'string' || type === 'boolean') return
  if (type === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be a finite number, got ${value}`)
    assert.ok(!Object.is(value, -0), `${path} must not be -0`)
    return
  }
  assert.ok(type === 'object', `${path} must not be ${type}`)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertLosslessJson(item, `${path}[${index}]`))
    return
  }
  assert.equal(Object.getPrototypeOf(value), Object.prototype, `${path} must be a plain object`)
  for (const [key, item] of Object.entries(value)) assertLosslessJson(item, `${path}.${key}`)
}

function chunkOfType(chunks, type) {
  return chunks.filter(chunk => chunk.type === type)
}

// Frame shapes below are captured verbatim from cli-chat-proxy.grok.com
// /v1/responses: note that the arguments *delta* has no `name` field; the
// name only appears on output_item.added and function_call_arguments.done.
const functionCallAdded = {
  sequence_number: 32,
  type: 'response.output_item.added',
  item: {
    arguments: '',
    call_id: 'call-0c7ecc4c-fcf5-42eb-b757-7cfbc1d11f88-0',
    name: 'bash',
    type: 'function_call',
    id: 'fc_edfecde2-decc-9ea1-ac40-7d169aecdce0_0',
    status: 'in_progress',
  },
  output_index: 1,
}

const argumentsDelta = {
  sequence_number: 33,
  type: 'response.function_call_arguments.delta',
  delta: '{"command":"pwd"}',
  item_id: 'fc_edfecde2-decc-9ea1-ac40-7d169aecdce0_0',
  output_index: 1,
}

const argumentsDone = {
  sequence_number: 34,
  type: 'response.function_call_arguments.done',
  arguments: '{"command":"pwd"}',
  item_id: 'fc_edfecde2-decc-9ea1-ac40-7d169aecdce0_0',
  name: 'bash',
  output_index: 1,
}

const completed = {
  sequence_number: 35,
  type: 'response.completed',
  response: {
    id: 'resp-1',
    status: 'completed',
    output: [{
      arguments: '{"command":"pwd"}',
      call_id: 'call-0c7ecc4c-fcf5-42eb-b757-7cfbc1d11f88-0',
      name: 'bash',
      type: 'function_call',
      id: 'fc_edfecde2-decc-9ea1-ac40-7d169aecdce0_0',
      status: 'completed',
    }],
    usage: { input_tokens: 120, output_tokens: 8, total_tokens: 128 },
  },
}

test('every emitted chunk is losslessly JSON-serializable', async () => {
  const chunks = await collect([functionCallAdded, argumentsDelta, argumentsDone, completed])
  assert.ok(chunks.length > 0)
  chunks.forEach((chunk, index) => assertLosslessJson(chunk, `chunk[${index}]`))
})

test('tool-call delta carries the real tool name from output_item.added', async () => {
  const chunks = await collect([functionCallAdded, argumentsDelta, argumentsDone, completed])
  const deltas = chunkOfType(chunks, 'tool-call-delta')
  assert.equal(deltas.length, 1)
  assert.equal(deltas[0].name, 'bash')
  assert.equal(deltas[0].argumentsDelta, '{"command":"pwd"}')
})

test('tool-call block-end keeps the name and the full arguments', async () => {
  const chunks = await collect([functionCallAdded, argumentsDelta, argumentsDone, completed])
  const ends = chunkOfType(chunks, 'block-end').filter(chunk => chunk.block?.type === 'tool-call')
  assert.equal(ends.length, 1)
  assert.equal(ends[0].block.name, 'bash')
  assert.equal(ends[0].block.arguments, '{"command":"pwd"}')
  assert.equal(chunks.at(-1).reason.kind, 'tool-calls')
})

test('a bare arguments delta still yields a string name, never undefined', async () => {
  const chunks = await collect([argumentsDelta, completed])
  const deltas = chunkOfType(chunks, 'tool-call-delta')
  assert.equal(deltas.length, 1)
  assert.equal(typeof deltas[0].name, 'string')
  assert.ok(deltas[0].name.length > 0)
  chunks.forEach((chunk, index) => assertLosslessJson(chunk, `chunk[${index}]`))
})

test('tool calls announced only in response.completed are not lost', async () => {
  const chunks = await collect([completed])
  const ends = chunkOfType(chunks, 'block-end').filter(chunk => chunk.block?.type === 'tool-call')
  assert.equal(ends.length, 1)
  assert.equal(ends[0].block.name, 'bash')
  assert.equal(ends[0].block.arguments, '{"command":"pwd"}')
  assert.equal(chunks.at(-1).reason.kind, 'tool-calls')
  chunks.forEach((chunk, index) => assertLosslessJson(chunk, `chunk[${index}]`))
})

test('usage without total_tokens still emits a finite total', async () => {
  const chunks = await collect([{
    type: 'response.completed',
    response: { status: 'completed', output: [], usage: { input_tokens: 10, output_tokens: 4 } },
  }])
  const usage = chunkOfType(chunks, 'usage')
  assert.equal(usage.length, 1)
  assert.equal(usage[0].usage.totalTokens, 14)
})

test('a provider error frame with no status stays JSON-safe', async () => {
  const chunks = await collect([{
    type: 'response.failed',
    error: { message: 'boom' },
  }])
  chunks.forEach((chunk, index) => assertLosslessJson(chunk, `chunk[${index}]`))
  const finish = chunks.at(-1)
  assert.equal(finish.reason.kind, 'error')
  assert.equal(finish.reason.failure.message, 'boom')
})

test('a non-string provider error message degrades to a string', async () => {
  const chunks = await collect([{
    type: 'response.failed',
    error: { message: { nested: 'object' }, status: 502 },
  }])
  chunks.forEach((chunk, index) => assertLosslessJson(chunk, `chunk[${index}]`))
  const finish = chunks.at(-1)
  assert.equal(typeof finish.reason.failure.message, 'string')
  assert.equal(finish.reason.failure.status, 502)
})
