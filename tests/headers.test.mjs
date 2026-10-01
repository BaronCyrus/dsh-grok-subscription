import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProxyHeaders, fingerprintHeaders, parseClientVersion, readClientVersion, releaseAtLeast } from '../src/headers.js'
import {
  CLIENT_IDENTIFIER,
  CLIENT_IDENTIFIER_HEADER,
  CLIENT_VERSION_FALLBACK,
  CLIENT_VERSION_HEADER,
  CLIENT_VERSION_MINIMUM,
  TOKEN_AUTH_HEADER,
  TOKEN_AUTH_VALUE,
} from '../src/constants.js'

test('builds the required subscription proxy headers without leaking extra endpoints', () => {
  const headers = buildProxyHeaders('test-access-token', { version: '1.0.5', identifier: CLIENT_IDENTIFIER })
  assert.equal(headers.Authorization, 'Bearer test-access-token')
  assert.equal(headers[TOKEN_AUTH_HEADER], TOKEN_AUTH_VALUE)
  assert.equal(headers[CLIENT_IDENTIFIER_HEADER], CLIENT_IDENTIFIER)
  assert.equal(headers[CLIENT_VERSION_HEADER], '1.0.5')
  assert.equal(headers['User-Agent'], `${CLIENT_IDENTIFIER}/1.0.5`)
  assert.equal(Object.keys(headers).length, 5)
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

test('the advertised fallback stays a release at or above the proxy minimum', () => {
  assert.equal(releaseAtLeast(CLIENT_VERSION_FALLBACK, CLIENT_VERSION_MINIMUM), true)
  assert.equal(releaseAtLeast('1.0.13', CLIENT_VERSION_MINIMUM), true)
  assert.equal(releaseAtLeast('1.0.14', '1.0.13'), true)
  assert.equal(releaseAtLeast('1.1.0', '1.0.13'), true)
  assert.equal(releaseAtLeast('2.0.0', '1.0.13'), true)
  assert.equal(releaseAtLeast('1.0.5', CLIENT_VERSION_MINIMUM), false)
  assert.equal(releaseAtLeast('1.0.12', CLIENT_VERSION_MINIMUM), false)
  assert.equal(releaseAtLeast('1.0.13-rc1', CLIENT_VERSION_MINIMUM), false)
  assert.equal(releaseAtLeast('99.0.0-rc1', CLIENT_VERSION_FALLBACK), false)
  assert.notEqual(CLIENT_VERSION_FALLBACK, '1.0.5')
})

test('a machine with no CLI advertises the fallback on both version headers', () => {
  const headers = fingerprintHeaders({ env: {}, exists: () => false })
  assert.equal(headers[CLIENT_VERSION_HEADER], CLIENT_VERSION_FALLBACK)
  assert.equal(headers['User-Agent'], `${CLIENT_IDENTIFIER}/${CLIENT_VERSION_FALLBACK}`)
  assert.equal(readClientVersion({}, { exists: () => false }), CLIENT_VERSION_FALLBACK)
})

test('a stale or prerelease version.json cannot pull the header below the fallback', () => {
  for (const version of ['1.0.5', '1.0.12', '1.0.13', '1.0.13-rc1', '2.0.0', 'nope']) {
    const read = readClientVersion({}, {
      exists: () => true,
      read: () => JSON.stringify({ version }),
    })
    assert.equal(read, CLIENT_VERSION_FALLBACK, version)
  }
  assert.equal(readClientVersion({}, { exists: () => true, read: () => '{' }), CLIENT_VERSION_FALLBACK)
  assert.equal(readClientVersion({}, { exists: () => true, read: () => { throw new Error('denied') } }), CLIENT_VERSION_FALLBACK)
  assert.equal(readClientVersion({}, { exists: () => true, read: () => JSON.stringify({}) }), CLIENT_VERSION_FALLBACK)
})

test('a CLI release at or above the fallback is advertised as itself', () => {
  const read = readClientVersion({}, {
    exists: () => true,
    read: () => JSON.stringify({ version: '100.0.0' }),
  })
  assert.equal(read, '100.0.0')
})

test('DSH_GROK_CLIENT_VERSION wins exactly as set, including a value below the minimum', () => {
  const read = readClientVersion(
    { DSH_GROK_CLIENT_VERSION: ' 1.2.3 ' },
    { exists: () => true, read: () => JSON.stringify({ version: '100.0.0' }) },
  )
  assert.equal(read, '1.2.3')
  assert.equal(readClientVersion({ DSH_GROK_CLIENT_VERSION: '   ' }, { exists: () => false }), CLIENT_VERSION_FALLBACK)
})

test('refuses to build headers without a token', () => {
  assert.throws(() => buildProxyHeaders(''), /access token/)
})
