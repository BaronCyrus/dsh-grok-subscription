import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inspectAuthFileSafety, isApiKeyOnlyEntry, maskAccount, parseAuthDocument } from '../src/auth-file.js'
import { API_KEY_SCOPE } from '../src/constants.js'

const oauthScope = 'https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828'
const oauthEntry = {
  key: 'access-token-oauth-session',
  auth_mode: 'oidc',
  email: 'alice@example.com',
  user_id: 'user-1',
  refresh_token: 'refresh-token-placeholder',
  expires_at: '2026-10-01T00:00:00Z',
  oidc_issuer: 'https://auth.x.ai',
  oidc_client_id: 'b1a00492-073a-47ea-816f-4c329264a828',
}

test('selects an OIDC SuperGrok session and masks the account', () => {
  const parsed = parseAuthDocument({ [oauthScope]: oauthEntry })
  assert.equal(parsed.reason, undefined)
  assert.equal(parsed.session.accessToken, 'access-token-oauth-session')
  assert.equal(parsed.session.authMode, 'oidc')
  assert.equal(parsed.session.maskedAccount, 'a•••e@example.com')
})

test('rejects an API-key-only auth.json as a subscription login', () => {
  const parsed = parseAuthDocument({
    [API_KEY_SCOPE]: { key: 'xai-api-key-value', auth_mode: 'api_key' },
  })
  assert.equal(parsed.session, undefined)
  assert.equal(parsed.reason, 'api-key-only')
})

test('ignores an API-key entry when an OAuth session is also present', () => {
  const parsed = parseAuthDocument({
    [API_KEY_SCOPE]: { key: 'xai-api-key-value', auth_mode: 'api_key' },
    [oauthScope]: oauthEntry,
  })
  assert.equal(parsed.session.accessToken, 'access-token-oauth-session')
  assert.equal(parsed.session.scope, oauthScope)
})

test('does not treat a bare key without OAuth fields as a subscription session', () => {
  assert.equal(isApiKeyOnlyEntry({ key: 'xai-plain-key' }, 'custom'), true)
  const parsed = parseAuthDocument({ custom: { key: 'xai-plain-key' } })
  assert.equal(parsed.reason, 'api-key-only')
})

test('accepts a top-level access_token plus issuer as a session', () => {
  const parsed = parseAuthDocument({
    access_token: 'top-level-access',
    oidc_issuer: 'https://auth.x.ai',
    email: 'bob@x.ai',
  })
  assert.equal(parsed.session.accessToken, 'top-level-access')
  assert.equal(parsed.session.maskedAccount, 'b•••b@x.ai')
})

test('refuses group/other-readable files, symlinks, and non-files', () => {
  assert.throws(() => inspectAuthFileSafety({ isSymbolicLink: true, isFile: true, mode: 0o600, uid: 1 }, { uid: 1, platform: 'linux' }), /symbolic-link/)
  assert.throws(() => inspectAuthFileSafety({ isSymbolicLink: false, isFile: false, mode: 0o600, uid: 1 }, { uid: 1, platform: 'linux' }), /regular file/)
  assert.throws(() => inspectAuthFileSafety({ isSymbolicLink: false, isFile: true, mode: 0o640, uid: 1 }, { uid: 1, platform: 'linux' }), /owner-only/)
  assert.throws(() => inspectAuthFileSafety({ isSymbolicLink: false, isFile: true, mode: 0o600, uid: 2 }, { uid: 1, platform: 'linux' }), /not owned/)
  inspectAuthFileSafety({ isSymbolicLink: false, isFile: true, mode: 0o600, uid: 1 }, { uid: 1, platform: 'linux' })
})

test('maskAccount hides local-part characters', () => {
  assert.equal(maskAccount('ab@x.ai'), 'a••@x.ai')
  assert.equal(maskAccount('xy'), 'x•')
})
