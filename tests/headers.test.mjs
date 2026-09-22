import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProxyHeaders, fingerprintHeaders, parseClientVersion } from '../src/headers.js'
import {
  CLIENT_IDENTIFIER,
  CLIENT_IDENTIFIER_HEADER,
  CLIENT_VERSION_FALLBACK,
  CLIENT_VERSION_HEADER,
  TOKEN_AUTH_HEADER,
  TOKEN_AUTH_VALUE,
} from '../src/constants.js'

test('builds the required subscription proxy headers without leaking extra endpoints', () => {
  const headers = buildProxyHeaders('test-access-token', { version: '1.0.5', identifier: CLIENT_IDENTIFIER })
  assert.equal(headers.Authorization, 'Bearer test-access-token')
  assert.equal(headers[TOKEN_AUTH_HEADER], TOKEN_AUTH_VALUE)
  assert.equal(headers[CLIENT_IDENTIFIER_HEADER], CLIENT_IDENTIFIER)
  assert.equal(headers[CLIENT_VERSION_HEADER], '1.0.5')
  assert.equal(Object.keys(headers).length, 4)
})

test('fingerprint headers omit Authorization so the token can be attached separately', () => {
  const headers = fingerprintHeaders({ version: CLIENT_VERSION_FALLBACK })
  assert.equal(headers.Authorization, undefined)
  assert.equal(headers[TOKEN_AUTH_HEADER], TOKEN_AUTH_VALUE)
})

test('reads the CLI version from common version.json shapes', () => {
  assert.equal(parseClientVersion({ version: '1.0.5' }), '1.0.5')
  assert.equal(parseClientVersion({ cliVersion: '1.0.4' }), '1.0.4')
  assert.equal(parseClientVersion({ grok: { version: '0.2.5' } }), '0.2.5')
  assert.equal(parseClientVersion({}), undefined)
})

test('refuses to build headers without a token', () => {
  assert.throws(() => buildProxyHeaders(''), /access token/)
})
