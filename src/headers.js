import { readFileSync, existsSync } from 'node:fs'
import {
  CLIENT_IDENTIFIER,
  CLIENT_IDENTIFIER_HEADER,
  CLIENT_VERSION_FALLBACK,
  CLIENT_VERSION_HEADER,
  TOKEN_AUTH_HEADER,
  TOKEN_AUTH_VALUE,
} from './constants.js'
import { versionJsonPath } from './auth-file.js'

export function parseClientVersion(document) {
  if (typeof document === 'string' && document.trim()) return document.trim()
  if (!document || typeof document !== 'object') return undefined
  for (const key of ['version', 'cliVersion', 'cli_version', 'grokVersion']) {
    if (typeof document[key] === 'string' && document[key].trim()) return document[key].trim()
  }
  if (document.grok && typeof document.grok === 'object' && typeof document.grok.version === 'string') {
    return document.grok.version.trim()
  }
  return undefined
}

/** True when `version` is a release (not a prerelease) at or above `minimum`. */
export function releaseAtLeast(version, minimum) {
  const parse = value => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(typeof value === 'string' ? value.trim() : '')
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
  }
  const left = parse(version)
  const right = parse(minimum)
  if (!left || !right) return false
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index]
  }
  return true
}

export function readClientVersion(env = process.env, options = {}) {
  if (typeof env.DSH_GROK_CLIENT_VERSION === 'string' && env.DSH_GROK_CLIENT_VERSION.trim()) {
    return env.DSH_GROK_CLIENT_VERSION.trim()
  }
  const fallback = options.fallback ?? CLIENT_VERSION_FALLBACK
  const path = options.path ?? versionJsonPath(env)
  const exists = options.exists ?? existsSync
  const read = options.read ?? (target => readFileSync(target, 'utf8'))
  if (!exists(path)) return fallback
  try {
    const parsed = parseClientVersion(JSON.parse(read(path)))
    // Never advertise a version older than the fallback. The proxy rejects
    // only versions that are too old, including a stale CLI version.json.
    return parsed && releaseAtLeast(parsed, fallback) ? parsed : fallback
  } catch {
    return fallback
  }
}

/**
 * Headers required by the Grok Build subscription proxy (community / official CLI practice).
 * Does not include Authorization so callers can attach the bearer separately or via apiKey.
 */
export function fingerprintHeaders(options = {}) {
  const identifier = options.identifier ?? CLIENT_IDENTIFIER
  const version = options.version ?? readClientVersion(options.env, options)
  return Object.freeze({
    [TOKEN_AUTH_HEADER]: TOKEN_AUTH_VALUE,
    [CLIENT_IDENTIFIER_HEADER]: identifier,
    [CLIENT_VERSION_HEADER]: version,
    'User-Agent': `${identifier}/${version}`,
  })
}

export function buildProxyHeaders(accessToken, options = {}) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('A Grok Build access token is required to build proxy headers')
  }
  return Object.freeze({
    Authorization: `Bearer ${accessToken}`,
    ...fingerprintHeaders(options),
  })
}
