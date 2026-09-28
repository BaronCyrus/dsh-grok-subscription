import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { withGrokRequestSemantics } from '../src/adapter.js'
import { PROVIDER_ID, PROXY_BASE_URL } from '../src/constants.js'

/**
 * Drives the real pi-ai Responses API with the plugin's wrapper in front of it
 * and returns the request the proxy would receive.
 *
 * This is the one place the plugin's two request fields can be checked end to
 * end: `withGrokRequestSemantics` works by assigning `options.samplingParams`,
 * which only reaches the body because pi-ai's `buildParams` assigns it over
 * `params` as its last step. A pi-ai release that reorders that step would
 * silently drop both fields, and the bundled-path tests cannot see it.
 */
async function captureRequest(options, modelOverrides = {}) {
  const model = {
    id: 'grok-4.7',
    name: 'Grok 4.7',
    api: 'openai-responses',
    provider: PROVIDER_ID,
    baseUrl: PROXY_BASE_URL,
    reasoning: true,
    thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 500_000,
    maxTokens: 500_000,
    compat: { supportsLongCacheRetention: false, supportsDeveloperRole: false },
    ...modelOverrides,
  }
  const context = {
    system: 'You are a test.',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'say ok' }] }],
    tools: [],
  }

  const previous = globalThis.fetch
  let captured
  globalThis.fetch = async (url, init) => {
    captured = {
      url: String(url),
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: JSON.parse(init.body),
    }
    return new Response(
      'data: {"type":"response.completed","response":{"status":"completed"}}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }
  try {
    const api = withGrokRequestSemantics(openAIResponsesApi())
    for await (const _chunk of api.stream(model, context, options)) {
      // Drain: the request is what this test asserts on.
    }
  } finally {
    globalThis.fetch = previous
  }
  assert.ok(captured, 'the wrapped api must issue exactly one request')
  return captured
}

test('the real pi-ai body carries the include and the session cache key', async () => {
  const { url, body } = await captureRequest({ apiKey: 'test-key', sessionId: 'session-123', reasoningEffort: 'high' })

  assert.equal(url, `${PROXY_BASE_URL}/responses`)
  assert.equal(body.model, 'grok-4.7')
  assert.equal(body.stream, true)
  assert.equal(body.store, false)
  assert.deepEqual(body.include, ['reasoning.encrypted_content'])
  assert.equal(body.prompt_cache_key, 'grok:session-123')
  assert.deepEqual(body.input, [{ role: 'user', content: [{ type: 'input_text', text: 'say ok' }] }])
  assert.deepEqual(body.reasoning, { effort: 'high', summary: 'auto' })
})

test('a disabled cache leaves no prompt_cache_key in the real body', async () => {
  const { body } = await captureRequest({ apiKey: 'test-key', sessionId: 'session-123', cacheRetention: 'none' })

  assert.equal(body.prompt_cache_key, undefined)
  assert.deepEqual(body.include, ['reasoning.encrypted_content'])
})

test('a session-less call still asks for encrypted reasoning', async () => {
  const { body } = await captureRequest({ apiKey: 'test-key' })

  assert.equal(body.prompt_cache_key, undefined)
  assert.deepEqual(body.include, ['reasoning.encrypted_content'])
})
