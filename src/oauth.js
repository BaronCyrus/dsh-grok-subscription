import { CLI_REFRESH_TIMEOUT_MS, GROK_OIDC_CLIENT_ID, XAI_OAUTH_ISSUER } from './constants.js'
import { readResponseText } from './http-json.js'

/**
 * Public OAuth client of the official Grok CLI. There is no client secret:
 * RFC 8628 device-code login and refresh both authenticate the user, not an app.
 */
export const OAUTH_SCOPES = 'openid profile email offline_access api:access grok-cli:access'

const OAUTH_BODY_LIMIT = 64 * 1024
const OAUTH_ERROR_LIMIT = 180

function collapse(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, OAUTH_ERROR_LIMIT)
}

function oauthError(body, status) {
  const code = collapse(body?.error) || 'request_failed'
  const description = collapse(body?.error_description)
  if (description && description !== code) return `${code}: ${description} (HTTP ${status})`
  return `${code} (HTTP ${status})`
}

async function readOauthBody(response) {
  const status = typeof response.status === 'number' ? response.status : 0
  const declared = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(declared) && declared > OAUTH_BODY_LIMIT) {
    throw new Error(`OAuth response exceeded ${OAUTH_BODY_LIMIT} bytes (HTTP ${status})`)
  }
  let text
  try {
    text = await readResponseText(response)
  } catch (error) {
    throw new Error(`OAuth response could not be read (HTTP ${status})`, { cause: error })
  }
  if (typeof text !== 'string' || text.length > OAUTH_BODY_LIMIT) {
    throw new Error(`OAuth response exceeded ${OAUTH_BODY_LIMIT} bytes (HTTP ${status})`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`OAuth endpoint returned HTTP ${status} with a non-JSON body`)
  }
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  return undefined
}

async function postForm(url, params, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
    signal: timeoutSignal(CLI_REFRESH_TIMEOUT_MS),
  })
  const body = await readOauthBody(response)
  return { status: typeof response.status === 'number' ? response.status : 0, body }
}

/** https URL on x.ai or a subdomain, with no embedded credentials. */
export function isXaiHttpsUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (host === 'x.ai' || host.endsWith('.x.ai'))
  } catch {
    return false
  }
}

function endpointOnIssuer(value, issuer, field) {
  let url
  let issuerUrl
  try {
    url = new URL(value)
    issuerUrl = new URL(issuer)
  } catch {
    throw new Error(`OIDC discovery returned an invalid ${field}`)
  }
  if (url.protocol !== 'https:' || issuerUrl.protocol !== 'https:') {
    throw new Error(`OIDC discovery returned a non-HTTPS ${field}`)
  }
  if (url.username || url.password) throw new Error(`OIDC discovery returned credentials in ${field}`)
  if (url.origin !== issuerUrl.origin) throw new Error(`OIDC discovery ${field} does not match the issuer`)
  return url.toString()
}

export function fallbackOauthEndpoints(issuer = XAI_OAUTH_ISSUER) {
  const base = String(issuer).replace(/\/+$/u, '')
  return {
    deviceAuthorizationEndpoint: `${base}/oauth2/device/code`,
    tokenEndpoint: `${base}/oauth2/token`,
  }
}

/**
 * Read the device and token endpoints from the issuer's discovery document.
 * A failed or mismatched document falls back to the documented paths on the
 * same issuer; it never follows an endpoint on another origin.
 */
export async function discoverOauthEndpoints(issuer = XAI_OAUTH_ISSUER, options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const base = String(issuer).replace(/\/+$/u, '')
  try {
    const response = await fetchImpl(`${base}/.well-known/openid-configuration`, {
      headers: { accept: 'application/json' },
      signal: timeoutSignal(CLI_REFRESH_TIMEOUT_MS),
    })
    const body = await readOauthBody(response)
    const status = typeof response.status === 'number' ? response.status : 0
    if (status < 200 || status >= 300) throw new Error(`OIDC discovery failed (HTTP ${status})`)
    const discovered = typeof body?.issuer === 'string' ? body.issuer.replace(/\/+$/u, '') : ''
    if (discovered !== base) throw new Error('OIDC discovery issuer does not match the requested issuer')
    return {
      deviceAuthorizationEndpoint: endpointOnIssuer(body.device_authorization_endpoint, base, 'device_authorization_endpoint'),
      tokenEndpoint: endpointOnIssuer(body.token_endpoint, base, 'token_endpoint'),
    }
  } catch {
    return fallbackOauthEndpoints(base)
  }
}

function clockMs(now) {
  if (typeof now === 'function') return now()
  if (typeof now === 'number' && Number.isFinite(now)) return now
  return Date.now()
}

function expiresAtFrom(body, accessToken, nowMs) {
  if (typeof body?.expires_in === 'number' && Number.isFinite(body.expires_in) && body.expires_in > 0) {
    return new Date(nowMs + body.expires_in * 1000).toISOString()
  }
  const exp = jwtExpiryMs(accessToken)
  return typeof exp === 'number' ? new Date(exp).toISOString() : undefined
}

function jwtExpiryMs(token) {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length < 2) return undefined
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (typeof payload?.exp === 'number' && Number.isFinite(payload.exp)) return payload.exp * 1000
  } catch {
    return undefined
  }
  return undefined
}

/**
 * Start a device-code login. Returns the codes the panel shows; the device
 * code itself stays on the host and is never returned through RPC.
 */
export async function requestDeviceAuthorization(options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const clientId = options.clientId ?? GROK_OIDC_CLIENT_ID
  const scopes = options.scopes ?? OAUTH_SCOPES
  const endpoint = options.endpoint
  if (!isXaiHttpsUrl(endpoint)) throw new Error('Refusing to request a device code from a non-x.ai endpoint')
  const { status, body } = await postForm(endpoint, {
    client_id: clientId,
    scope: scopes,
  }, fetchImpl)
  if (body?.error || status < 200 || status >= 300) {
    throw new Error(`Could not start device sign-in: ${oauthError(body, status)}`)
  }
  const deviceCode = typeof body?.device_code === 'string' ? body.device_code : ''
  const userCode = typeof body?.user_code === 'string' ? body.user_code : ''
  const verificationUri = typeof body?.verification_uri === 'string' ? body.verification_uri : undefined
  const verificationUriComplete = typeof body?.verification_uri_complete === 'string' ? body.verification_uri_complete : undefined
  if (!deviceCode || !userCode) throw new Error('Device sign-in returned no user code')
  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    expiresIn: typeof body?.expires_in === 'number' ? body.expires_in : undefined,
    interval: typeof body?.interval === 'number' ? body.interval : undefined,
  }
}

/**
 * One poll of the device-code grant. `authorization_pending` and `slow_down`
 * are not failures; anything else stops the loop.
 */
export async function exchangeDeviceCode(options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const clientId = options.clientId ?? GROK_OIDC_CLIENT_ID
  const endpoint = options.endpoint
  if (!isXaiHttpsUrl(endpoint)) return { kind: 'stop', error: 'refusing a non-x.ai token endpoint' }
  const { status, body } = await postForm(endpoint, {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    client_id: clientId,
    device_code: options.deviceCode,
  }, fetchImpl)
  return classifyTokenResponse(body, status, clockMs(options.now))
}

/** Refresh-token grant. The caller writes the new tokens back to auth.json. */
export async function refreshOauthToken(options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const endpoint = options.endpoint
  if (!isXaiHttpsUrl(endpoint)) throw new Error('Refusing to refresh a token at a non-x.ai endpoint')
  const { status, body } = await postForm(endpoint, {
    grant_type: 'refresh_token',
    client_id: options.clientId ?? GROK_OIDC_CLIENT_ID,
    refresh_token: options.refreshToken,
  }, fetchImpl)
  const result = classifyTokenResponse(body, status, clockMs(options.now))
  if (result.kind !== 'ok') throw new Error(`Could not refresh the session: ${result.error ?? 'unknown'}`)
  return result
}

function classifyTokenResponse(body, status, nowMs) {
  const error = typeof body?.error === 'string' ? body.error : ''
  if (error === 'authorization_pending') return { kind: 'pending' }
  if (error === 'slow_down') return { kind: 'slow_down' }
  if (error) return { kind: 'stop', error: oauthError(body, status) }
  const accessToken = typeof body?.access_token === 'string' ? body.access_token : ''
  if (!accessToken || status < 200 || status >= 300) {
    return { kind: 'stop', error: oauthError(body, status) }
  }
  const refreshToken = typeof body?.refresh_token === 'string' && body.refresh_token ? body.refresh_token : undefined
  return {
    kind: 'ok',
    accessToken,
    refreshToken,
    expiresIn: typeof body?.expires_in === 'number' ? body.expires_in : undefined,
    expiresAt: expiresAtFrom(body, accessToken, nowMs),
    issuer: XAI_OAUTH_ISSUER,
    clientId: GROK_OIDC_CLIENT_ID,
  }
}
