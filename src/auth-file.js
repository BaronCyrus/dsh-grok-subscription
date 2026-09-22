import { lstatSync, openSync, readFileSync, closeSync, constants as fsConstants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  API_KEY_AUTH_MODES,
  API_KEY_SCOPE,
  AUTH_FILE_MAX_BYTES,
  SESSION_AUTH_MODES,
} from './constants.js'

const XAI_OAUTH_ISSUER = 'https://auth.x.ai'

export function grokHome(env = process.env) {
  const override = typeof env.GROK_HOME === 'string' && env.GROK_HOME.trim() ? env.GROK_HOME.trim() : undefined
  return override ?? join(homedir(), '.grok')
}

export function authJsonPath(env = process.env) {
  if (typeof env.DSH_GROK_AUTH_PATH === 'string' && env.DSH_GROK_AUTH_PATH.trim()) {
    return env.DSH_GROK_AUTH_PATH.trim()
  }
  return join(grokHome(env), 'auth.json')
}

export function versionJsonPath(env = process.env) {
  if (typeof env.DSH_GROK_VERSION_PATH === 'string' && env.DSH_GROK_VERSION_PATH.trim()) {
    return env.DSH_GROK_VERSION_PATH.trim()
  }
  return join(grokHome(env), 'version.json')
}

export function inspectAuthFileSafety(meta, options = {}) {
  const platform = options.platform ?? process.platform
  const currentUid = options.uid ?? process.getuid?.()
  if (meta.isSymbolicLink) {
    throw new Error('Refusing to read a symbolic-link Grok auth.json')
  }
  if (!meta.isFile) {
    throw new Error('Grok auth.json is not a regular file')
  }
  if (typeof meta.size === 'number' && meta.size > AUTH_FILE_MAX_BYTES) {
    throw new Error('Grok auth.json is larger than the allowed size')
  }
  if (platform === 'win32') return
  if (typeof meta.mode === 'number' && (meta.mode & 0o077) !== 0) {
    throw new Error('Grok auth.json must be owner-only (chmod 600); group/other access is refused')
  }
  if (typeof currentUid === 'number' && typeof meta.uid === 'number' && meta.uid !== currentUid) {
    throw new Error('Grok auth.json is not owned by the current user')
  }
}

export function readSecureJsonFile(path, options = {}) {
  const lstat = options.lstat ?? (target => lstatSync(target, { throwIfNoEntry: false }))
  const read = options.read ?? (target => {
    const fd = openSync(target, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0))
    try {
      return readFileSync(fd, 'utf8')
    } finally {
      closeSync(fd)
    }
  })
  const stat = lstat(path)
  if (!stat) throw new Error(`Grok file not found: ${path}`)
  inspectAuthFileSafety({
    isSymbolicLink: typeof stat.isSymbolicLink === 'function' ? stat.isSymbolicLink() : Boolean(stat.isSymbolicLink),
    isFile: typeof stat.isFile === 'function' ? stat.isFile() : Boolean(stat.isFile),
    mode: stat.mode,
    uid: stat.uid,
    size: stat.size,
  }, options)
  const text = read(path)
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('Grok auth document is empty')
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error('Grok auth document is not valid JSON', { cause: error })
  }
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeAuthMode(value) {
  if (typeof value !== 'string') return undefined
  return value.trim().toLowerCase()
}

function accessTokenFromEntry(entry) {
  if (typeof entry === 'string') return asNonEmptyString(entry)
  if (!entry || typeof entry !== 'object') return undefined
  return asNonEmptyString(entry.key)
    ?? asNonEmptyString(entry.access_token)
    ?? asNonEmptyString(entry.accessToken)
}

export function isApiKeyOnlyEntry(entry, scope) {
  if (scope === API_KEY_SCOPE) return true
  if (typeof entry === 'string') return false
  if (!entry || typeof entry !== 'object') return true
  const mode = normalizeAuthMode(entry.auth_mode ?? entry.authMode)
  if (mode && API_KEY_AUTH_MODES.includes(mode)) return true
  if (mode && SESSION_AUTH_MODES.includes(mode)) return false
  const token = accessTokenFromEntry(entry)
  const refresh = asNonEmptyString(entry.refresh_token ?? entry.refreshToken)
  const issuer = asNonEmptyString(entry.oidc_issuer ?? entry.oidcIssuer)
  if (token && (refresh || issuer || mode)) return false
  if (token && !refresh && !issuer && !mode) return true
  return !token
}

export function maskAccount(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const text = value.trim()
  if (!text.includes('@')) {
    if (text.length <= 2) return `${text[0] ?? ''}•`
    return `${text[0]}•••${text.at(-1)}`
  }
  const [local, domain] = text.split('@', 2)
  if (!domain) return '••••'
  if (local.length <= 2) return `${local.slice(0, 1)}••@${domain}`
  return `${local[0]}•••${local.at(-1)}@${domain}`
}

function sessionFromEntry(scope, entry) {
  if (isApiKeyOnlyEntry(entry, scope)) return undefined
  const token = accessTokenFromEntry(entry)
  if (!token) return undefined
  const object = entry && typeof entry === 'object' ? entry : {}
  const email = asNonEmptyString(object.email)
  const userId = asNonEmptyString(object.user_id ?? object.userId)
  const expiresAt = asNonEmptyString(object.expires_at ?? object.expiresAt)
  const authMode = normalizeAuthMode(object.auth_mode ?? object.authMode) ?? 'oidc'
  return Object.freeze({
    scope,
    accessToken: token,
    authMode,
    email,
    userId,
    expiresAt,
    maskedAccount: maskAccount(email) ?? maskAccount(userId),
  })
}

function preferredScopeScore(scope, entry) {
  const issuer = entry && typeof entry === 'object'
    ? asNonEmptyString(entry.oidc_issuer ?? entry.oidcIssuer)
    : undefined
  if (typeof scope === 'string' && scope.startsWith(`${XAI_OAUTH_ISSUER}::`)) return 3
  if (issuer === XAI_OAUTH_ISSUER) return 2
  if (SESSION_AUTH_MODES.includes(normalizeAuthMode(entry?.auth_mode ?? entry?.authMode) ?? '')) return 1
  return 0
}

/**
 * Parse a Grok CLI auth.json document and select a SuperGrok / X Premium
 * OAuth session. API-key-only entries are never treated as a subscription login.
 */
export function parseAuthDocument(document) {
  if (Array.isArray(document)) {
    return { session: undefined, reason: 'unsupported-shape' }
  }
  if (!document || typeof document !== 'object') {
    return { session: undefined, reason: 'invalid-document' }
  }

  if (asNonEmptyString(document.access_token) || asNonEmptyString(document.key)) {
    const session = sessionFromEntry('document', document)
    if (session) return { session, reason: undefined }
    if (isApiKeyOnlyEntry(document, document.scope)) {
      return { session: undefined, reason: 'api-key-only' }
    }
  }

  const candidates = []
  let sawApiKey = false
  for (const [scope, entry] of Object.entries(document)) {
    if (isApiKeyOnlyEntry(entry, scope)) {
      sawApiKey = true
      continue
    }
    const session = sessionFromEntry(scope, entry)
    if (session) candidates.push(session)
  }
  if (candidates.length === 0) {
    return { session: undefined, reason: sawApiKey ? 'api-key-only' : 'no-session' }
  }
  candidates.sort((a, b) => preferredScopeScore(b.scope, document[b.scope]) - preferredScopeScore(a.scope, document[a.scope]))
  return { session: candidates[0], reason: undefined }
}

export function readGrokAuthSession(path = authJsonPath(), options = {}) {
  const document = readSecureJsonFile(path, options)
  return parseAuthDocument(document)
}

export function publicSessionView(session) {
  if (!session) {
    return Object.freeze({
      signedIn: false,
      maskedAccount: undefined,
      authMode: undefined,
      source: undefined,
    })
  }
  return Object.freeze({
    signedIn: true,
    maskedAccount: session.maskedAccount,
    authMode: session.authMode,
    expiresAt: session.expiresAt,
    source: 'grok-cli',
  })
}
