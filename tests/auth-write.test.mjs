import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseAuthDocument, publicSessionView, readGrokAuthSession, writeOauthSession } from '../src/auth-file.js'
import { API_KEY_SCOPE, GROK_OIDC_CLIENT_ID, XAI_OAUTH_ISSUER } from '../src/constants.js'

const scope = `${XAI_OAUTH_ISSUER}::${GROK_OIDC_CLIENT_ID}`

function tempAuth() {
  const dir = mkdtempSync(join(tmpdir(), 'grok-auth-'))
  return { dir, path: join(dir, 'auth.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('public session view never carries the refresh token', () => {
  const parsed = parseAuthDocument({
    [scope]: {
      key: 'access-token-oauth-session',
      refresh_token: 'refresh-token-placeholder',
      auth_mode: 'oidc',
      email: 'alice@example.com',
      oidc_issuer: XAI_OAUTH_ISSUER,
      oidc_client_id: GROK_OIDC_CLIENT_ID,
    },
  })
  assert.equal(parsed.session.refreshToken, 'refresh-token-placeholder')
  const view = publicSessionView(parsed.session)
  assert.equal(view.signedIn, true)
  assert.equal(view.refreshToken, undefined)
  assert.equal(JSON.stringify(view).includes('refresh-token-placeholder'), false)
})

test('writeOauthSession preserves other entries and is mode 0600', () => {
  const { path, cleanup } = tempAuth()
  try {
    writeFileSync(path, JSON.stringify({
      [API_KEY_SCOPE]: { key: 'xai-api-key-value', auth_mode: 'api_key' },
      [scope]: { key: 'old-access', refresh_token: 'old-refresh', custom_flag: true },
    }), { mode: 0o600 })
    const written = writeOauthSession(path, {
      issuer: XAI_OAUTH_ISSUER,
      clientId: GROK_OIDC_CLIENT_ID,
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: '2026-10-01T00:00:00.000Z',
      email: 'alice@example.com',
    })
    assert.equal(written.session.accessToken, 'new-access')
    assert.equal(written.session.refreshToken, 'new-refresh')
    const document = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(document[API_KEY_SCOPE].key, 'xai-api-key-value')
    assert.equal(document[scope].custom_flag, true)
    assert.equal(document[scope].key, 'new-access')
    assert.equal((lstatSync(path).mode & 0o777), 0o600)
    const reread = readGrokAuthSession(path)
    assert.equal(reread.session.accessToken, 'new-access')
  } finally {
    cleanup()
  }
})

test('writeOauthSession refuses a symlink and does not follow it', () => {
  const { dir, cleanup } = tempAuth()
  try {
    const real = join(dir, 'real.json')
    const link = join(dir, 'auth.json')
    writeFileSync(real, '{"keep":true}\n', { mode: 0o600 })
    chmodSync(real, 0o600)
    symlinkSync(real, link)
    assert.throws(() => writeOauthSession(link, {
      issuer: XAI_OAUTH_ISSUER,
      clientId: GROK_OIDC_CLIENT_ID,
      accessToken: 'should-not-land',
      refreshToken: 'should-not-land',
    }), /symbolic-link/)
    assert.equal(readFileSync(real, 'utf8').includes('should-not-land'), false)
  } finally {
    cleanup()
  }
})
