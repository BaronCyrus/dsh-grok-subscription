import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { decodeCompressedBody, readResponseJson, readResponseText } from '../src/http-json.js'
import { fetchLiveCatalog } from '../src/catalog.js'

const JSON_BODY = JSON.stringify({ object: 'list', data: [{ id: 'grok-4.7' }, { id: 'grok-4.6' }] })
const GZIPPED = gzipSync(Buffer.from(JSON_BODY, 'utf8'))

/** A response shaped like the one a header-stripping proxy forwards. */
function fakeResponse(buffer, encoding = null) {
  return {
    ok: true,
    status: 200,
    headers: { get: name => (name.toLowerCase() === 'content-encoding' ? encoding : null) },
    arrayBuffer: async () => buffer,
  }
}

test('an uncompressed body passes through untouched', () => {
  const buffer = Buffer.from(JSON_BODY, 'utf8')
  assert.equal(decodeCompressedBody(buffer, '').toString('utf8'), JSON_BODY)
})

// The regression: a local HTTP proxy forwards the gzipped bytes but drops
// Content-Encoding, so fetch never decodes them and JSON.parse sees 1f 8b.
test('gzip bytes are decoded even when no header announced them', async () => {
  const text = await readResponseText(fakeResponse(GZIPPED))
  assert.equal(text, JSON_BODY)
  assert.deepEqual(await readResponseJson(fakeResponse(GZIPPED)), JSON.parse(JSON_BODY))
})

test('a declared gzip encoding is decoded as well', async () => {
  assert.equal(await readResponseText(fakeResponse(GZIPPED, 'gzip')), JSON_BODY)
})

test('an undecodable body is returned raw so the caller reports the parse failure', () => {
  const broken = Buffer.concat([Buffer.from([0x1f, 0x8b]), Buffer.from('not really gzip')])
  assert.deepEqual(decodeCompressedBody(broken, ''), broken)
})

test('a decompression bomb is refused rather than expanded', () => {
  const huge = gzipSync(Buffer.alloc(256 * 1024, 0x20))
  assert.deepEqual(decodeCompressedBody(huge, '', { maxOutputBytes: 1024 }), huge)
})

test('fetchLiveCatalog reads a header-stripped gzip catalog', async () => {
  const models = await fetchLiveCatalog('token', {
    fetch: async () => fakeResponse(GZIPPED),
  })
  assert.deepEqual(models.map(model => model.id), ['grok-4.7', 'grok-4.6'])
})
