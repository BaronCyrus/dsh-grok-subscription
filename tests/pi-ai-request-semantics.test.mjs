import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withGrokRequestSemantics } from '../src/adapter.js'

/** Captures the pi-ai options the wrapper hands on. */
function recordingApi() {
  const seen = []
  const record = (_model, _context, options) => {
    seen.push(options)
    return { async *[Symbol.asyncIterator]() {} }
  }
  return { api: { stream: record, streamSimple: record }, seen }
}

test('the pi-ai path asks for encrypted reasoning and the session cache key', () => {
  const { api, seen } = recordingApi()
  const wrapped = withGrokRequestSemantics(api)

  wrapped.stream({}, {}, { apiKey: 'k', sessionId: 'session-123', samplingParams: { temperature: 0.2 } })
  wrapped.streamSimple({}, {}, { sessionId: 'session-456' })

  assert.deepEqual(seen[0].samplingParams.include, ['reasoning.encrypted_content'])
  // The bundled adapter namespaces the key this way; the upgrade must not
  // invalidate a conversation's cache by switching schemes.
  assert.equal(seen[0].samplingParams.prompt_cache_key, 'grok:session-123')
  assert.equal(seen[0].samplingParams.temperature, 0.2, 'existing sampling params survive')
  assert.equal(seen[0].apiKey, 'k', 'unrelated pi-ai options pass through')
  assert.equal(seen[1].samplingParams.prompt_cache_key, 'grok:session-456')
})

test('a cache the host disabled is never switched back on', () => {
  const { api, seen } = recordingApi()
  const wrapped = withGrokRequestSemantics(api)

  wrapped.stream({}, {}, { sessionId: 'session-123', cacheRetention: 'none' })

  assert.equal('prompt_cache_key' in seen[0].samplingParams, false)
  assert.deepEqual(seen[0].samplingParams.include, ['reasoning.encrypted_content'])
})

test('no session means no cache key, but the include still applies', () => {
  const { api, seen } = recordingApi()
  const wrapped = withGrokRequestSemantics(api)

  wrapped.stream({}, {}, {})
  wrapped.stream({}, {}, { sessionId: '   ' })

  for (const options of seen) {
    assert.equal('prompt_cache_key' in options.samplingParams, false)
    assert.deepEqual(options.samplingParams.include, ['reasoning.encrypted_content'])
  }
})

test('the pinned key stays the chat key, because pi-ai never receives a purpose', () => {
  const { api, seen } = recordingApi()
  const wrapped = withGrokRequestSemantics(api)

  wrapped.stream({}, {}, { sessionId: 'session-123' })

  assert.equal(seen[0].samplingParams.prompt_cache_key, 'grok:session-123')
  // `dsh-llm-pi-ai` forwards only `sessionId` out of GenerateOptions into pi-ai
  // (`snapshot.models.streamSimple(model, context, { … sessionId … })`), so a
  // compaction or session-title call arrives here with no purpose marker and
  // shares the chat key.
  //
  // That is a decision, not an oversight. The bundled adapter isolates those
  // calls behind `grok:compaction:<sessionId>`, but isolating them here would
  // mean suffixing the session id, which pi-ai also writes into the `session_id`
  // and `x-client-request-id` request headers. Measured against the live proxy,
  // isolation does not pay: after a large auxiliary call, repeating a chat
  // request still read the full prefix in 4 of 5 shared-key trials against 2 of
  // 5 isolated ones, and a control run with no auxiliary call at all read the
  // same full prefix. Sharing is at worst neutral, so this path keeps it.
})
