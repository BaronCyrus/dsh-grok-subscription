import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectImageParts, createDuckAdapter, responsesInput } from '../src/adapter.js'
import { toLlmModels } from '../src/catalog.js'

const REF = Object.freeze({
  attachmentId: 'a1',
  mediaType: 'image/png',
  bytes: 4,
  width: 2,
  height: 2,
  name: 'red.png',
})

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])

function store(overrides = {}) {
  return {
    async readImageRequest(ref) {
      return {
        variantId: 'v1',
        attachment: ref,
        data: PNG_BYTES,
        mediaType: 'image/png',
        bytes: PNG_BYTES.length,
        width: 2,
        height: 2,
        depth: 'uchar',
        space: 'srgb',
        hasAlpha: false,
      }
    },
    ...overrides,
  }
}

const userWithImage = content => ({ messages: [{ role: 'user', content }] })

test('collectImageParts inlines bytes as base64 keyed by attachment id', async () => {
  const parts = await collectImageParts(
    userWithImage([{ type: 'text', text: 'hi' }, { type: 'image', attachment: REF }]),
    () => store(),
  )
  const resolved = parts.get('a1')
  assert.equal(resolved.mediaType, 'image/png')
  assert.equal(resolved.base64, Buffer.from(PNG_BYTES).toString('base64'))
})

test('collectImageParts reads a repeated attachment only once', async () => {
  let reads = 0
  const parts = await collectImageParts(
    {
      messages: [
        { role: 'user', content: [{ type: 'image', attachment: REF }] },
        { role: 'user', content: [{ type: 'image', attachment: { ...REF, name: 'again.png' } }] },
      ],
    },
    () => store({ async readImageRequest(ref) { reads += 1; return store().readImageRequest(ref) } }),
  )
  assert.equal(reads, 1)
  assert.equal(parts.size, 1)
})

test('collectImageParts degrades to a placeholder when no store is available', async () => {
  const parts = await collectImageParts(userWithImage([{ type: 'image', attachment: REF }]), () => undefined)
  assert.equal(parts.get('a1'), undefined)
  assert.equal(parts.has('a1'), true, 'the attachment is tracked so the placeholder is used')
})

test('collectImageParts survives a store that throws or returns junk', async () => {
  const throwing = await collectImageParts(
    userWithImage([{ type: 'image', attachment: REF }]),
    () => store({ async readImageRequest() { throw new Error('disk on fire') } }),
  )
  assert.equal(throwing.get('a1'), undefined)

  const junk = await collectImageParts(
    userWithImage([{ type: 'image', attachment: REF }]),
    () => store({ async readImageRequest() { return { data: PNG_BYTES } } }),
  )
  assert.equal(junk.get('a1'), undefined)
})

test('collectImageParts ignores messages without images', async () => {
  const parts = await collectImageParts(
    { messages: [{ role: 'user', content: [{ type: 'text', text: 'no images here' }] }] },
    () => store(),
  )
  assert.equal(parts.size, 0)
})

test('responsesInput emits input_image parts for a user turn carrying an image', async () => {
  const options = userWithImage([
    { type: 'text', text: 'What color?' },
    { type: 'image', attachment: REF },
  ])
  const input = responsesInput(options, await collectImageParts(options, () => store()))
  assert.equal(input.length, 1)
  assert.equal(input[0].role, 'user')
  assert.deepEqual(input[0].content[0], { type: 'input_text', text: 'What color?' })
  assert.equal(input[0].content[1].type, 'input_image')
  assert.ok(
    input[0].content[1].image_url.startsWith('data:image/png;base64,'),
    'the image is inlined as a data URL',
  )
})

test('responsesInput falls back to placeholder text when the image cannot be read', async () => {
  const options = userWithImage([
    { type: 'text', text: 'What color?' },
    { type: 'image', attachment: REF },
  ])
  const input = responsesInput(options, await collectImageParts(options, () => undefined))
  const parts = input[0].content
  assert.equal(parts.length, 2)
  assert.deepEqual(parts[0], { type: 'input_text', text: 'What color?' })
  assert.equal(parts[1].type, 'input_text')
  assert.match(parts[1].text, /could not be included/)
  assert.match(parts[1].text, /red\.png/, 'the placeholder names the attachment')
})

test('text-only messages keep the compact string form', () => {
  const input = responsesInput(userWithImage([{ type: 'text', text: 'plain' }]), new Map())
  assert.deepEqual(input, [{ role: 'user', content: 'plain' }])
})

test('an image-only turn still produces a content array', async () => {
  const options = userWithImage([{ type: 'image', attachment: REF }])
  const input = responsesInput(options, await collectImageParts(options, () => store()))
  assert.equal(input.length, 1)
  assert.equal(input[0].content.length, 1)
  assert.equal(input[0].content[0].type, 'input_image')
})

test('toLlmModels advertises image input only for verified models', () => {
  const models = toLlmModels([
    { id: 'grok-4.7', name: 'Grok 4.7' },
    { id: 'grok-4.7-build-fast', name: 'Grok 4.7 Fast' },
    { id: 'grok-4.6', name: 'Grok 4.6' },
    { id: 'grok-4.5', name: 'Grok 4.5' },
  ])
  const byId = new Map(models.map(model => [model.id, model]))
  assert.deepEqual(byId.get('grok-4.7').inputModalities, ['text', 'image'])
  assert.deepEqual(byId.get('grok-4.7-build-fast').inputModalities, ['text', 'image'])
  assert.deepEqual(byId.get('grok-4.6').inputModalities, ['text', 'image'])
  // grok-4.5 confabulates instead of seeing images, so it must stay text-only.
  assert.deepEqual(byId.get('grok-4.5').inputModalities, ['text'])
})

/**
 * The host admits a prompt carrying an attachment only after
 * `llm.resolveModelInfo(provider, model).inputModalities` includes "image":
 * listModels feeds the picker, resolveModel feeds that gate. Declaring the
 * modality in one place but not the other rejects every paste — which is
 * exactly how a fix once shipped that only touched listModels.
 */
test('listModels and resolveModel agree on image modality', async () => {
  const sample = [
    { id: 'grok-4.7', name: 'Grok 4.7', contextWindow: 500_000, reasoning: true, reasoningEfforts: ['low', 'medium', 'high'], source: 'live' },
    { id: 'grok-4.7-build-fast', name: 'Grok 4.7 Fast', contextWindow: 500_000, reasoning: true, reasoningEfforts: ['low', 'medium', 'high'], source: 'live' },
    { id: 'grok-4.6', name: 'Grok 4.6', contextWindow: 500_000, reasoning: true, reasoningEfforts: ['low', 'medium', 'high'], source: 'live' },
    { id: 'grok-4.5', name: 'Grok 4.5', contextWindow: 500_000, reasoning: true, reasoningEfforts: ['low', 'medium', 'high'], source: 'live' },
  ]
  const duck = createDuckAdapter({
    publicAccount: () => ({ signedIn: true }),
    models: () => sample,
    currentToken: async () => 'token',
    logout: async () => {},
  })
  const listed = await duck.listModels('grok-build')
  assert.equal(listed.length, sample.length)
  for (const entry of listed) {
    const resolved = await duck.resolveModel('grok-build', entry.id)
    assert.deepEqual(
      resolved.inputModalities,
      entry.inputModalities,
      `${entry.id}: resolveModel must match listModels`,
    )
    const expected = entry.id === 'grok-4.5' ? ['text'] : ['text', 'image']
    assert.deepEqual(resolved.inputModalities, expected, `${entry.id}: expected ${expected.join('+')}`)
  }
})

test('resolveModel keeps unknown models text-only', async () => {
  const duck = createDuckAdapter({
    publicAccount: () => ({ signedIn: true }),
    models: () => [{ id: 'unknown-model', name: 'Unknown', reasoning: true, source: 'live' }],
    currentToken: async () => 'token',
    logout: async () => {},
  })
  assert.deepEqual((await duck.resolveModel('grok-build', 'unknown-model')).inputModalities, ['text'])
})
