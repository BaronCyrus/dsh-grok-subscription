import { brotliDecompressSync, gunzipSync, inflateSync, zstdDecompressSync } from 'node:zlib'

/**
 * Response bodies that arrive compressed with no usable `Content-Encoding`.
 *
 * A local HTTP proxy in front of the Grok proxy (or of the npm registry) can
 * forward the gzipped bytes while dropping `Content-Encoding`/`Content-Type`,
 * and Node's fetch only decodes what the header declares. `response.json()`
 * then fails with `Unexpected token '', "�..." is not valid JSON` — the leading
 * `1f 8b` of the gzip stream read as text. These helpers decode by magic bytes
 * as well, so a header-stripping hop cannot turn a healthy body into a parse
 * error.
 */

const MAGIC_GZIP = [0x1f, 0x8b]
const MAGIC_ZSTD = [0x28, 0xb5, 0x2f, 0xfd]
/** Decompressed ceiling: the JSON payloads here are model lists and usage blobs. */
const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024

function startsWith(buffer, bytes) {
  if (buffer.length < bytes.length) return false
  return bytes.every((byte, index) => buffer[index] === byte)
}

function maxOutputOf(options) {
  return typeof options.maxOutputBytes === 'number' && options.maxOutputBytes > 0
    ? options.maxOutputBytes
    : DEFAULT_MAX_OUTPUT_BYTES
}

/**
 * Decode a body that may be gzip/zstd/deflate/brotli compressed, whether or not
 * the response admitted it. Undecodable or oversized bodies come back untouched,
 * so the caller reports the same failure it would have reported before.
 * @param buffer - raw response bytes.
 * @param encoding - the response's `Content-Encoding`, when it survived the hop.
 * @param options - decompressed-size ceiling.
 * @returns decoded bytes.
 */
export function decodeCompressedBody(buffer, encoding = '', options = {}) {
  const declared = String(encoding ?? '').toLowerCase()
  const kind = declared.includes('gzip') || startsWith(buffer, MAGIC_GZIP)
    ? 'gzip'
    : declared.includes('zstd') || startsWith(buffer, MAGIC_ZSTD)
      ? 'zstd'
      : declared.includes('deflate')
        ? 'deflate'
        : declared.includes('br')
          ? 'br'
          : undefined
  if (!kind) return buffer
  const limits = { maxOutputLength: maxOutputOf(options) }
  try {
    if (kind === 'gzip') return gunzipSync(buffer, limits)
    if (kind === 'zstd') return zstdDecompressSync(buffer, limits)
    if (kind === 'deflate') return inflateSync(buffer, limits)
    return brotliDecompressSync(buffer, limits)
  } catch {
    return buffer
  }
}

/**
 * Read a response body as text, decoding a compressed body the header did not
 * announce. A minimal response shim (an injected `fetch` double that only
 * implements `text()`) still works.
 * @param response - a fetch Response.
 * @param options - decompressed-size ceiling.
 * @returns the decoded body text.
 */
export async function readResponseText(response, options = {}) {
  if (typeof response.arrayBuffer !== 'function') {
    if (typeof response.text === 'function') return response.text()
    throw new TypeError('response exposes neither arrayBuffer() nor text()')
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const encoding = typeof response.headers?.get === 'function'
    ? (response.headers.get('content-encoding') ?? '')
    : ''
  return decodeCompressedBody(buffer, encoding, options).toString('utf8')
}

/**
 * Read a response body as JSON, tolerating a stripped `Content-Encoding`.
 * @param response - a fetch Response.
 * @param options - decompressed-size ceiling.
 * @returns the parsed body.
 */
export async function readResponseJson(response, options = {}) {
  if (typeof response.arrayBuffer !== 'function' && typeof response.json === 'function') {
    return response.json()
  }
  return JSON.parse(await readResponseText(response, options))
}
