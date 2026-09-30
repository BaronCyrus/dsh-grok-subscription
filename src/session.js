import { spawn } from 'node:child_process'
import {
  CREDENTIAL_REF_NAME,
  CREDENTIALS_IO_TIMEOUT_MS,
  GROK_OIDC_CLIENT_ID,
  STORE_TOKEN_TIMEOUT_MS,
  TOKEN_EXPIRY_SKEW_MS,
  XAI_OAUTH_ISSUER,
} from './constants.js'
import { authJsonPath, publicSessionView, readGrokAuthSession, writeOauthSession } from './auth-file.js'
import { loadCatalog as defaultLoadCatalog } from './catalog.js'
import { fetchBillingUsage as defaultFetchBillingUsage, unavailableUsage } from './usage.js'
import { optionalImport } from './adapter.js'
import {
  discoverOauthEndpoints,
  exchangeDeviceCode,
  isXaiHttpsUrl,
  refreshOauthToken,
  requestDeviceAuthorization,
} from './oauth.js'

/**
 * Hand a URL to the user's browser. The desktop host owns no terminal, so the
 * sign-in link has to be opened from here; the panel also shows it when the
 * opener does not run.
 * @param url - absolute http(s) URL to open.
 * @param options - injectable spawn and platform, for tests.
 * @returns true when the platform opener exited cleanly.
 */
export function openExternal(url, options = {}) {
  const spawnFn = options.spawn ?? spawn
  const platform = options.platform ?? process.platform
  const [command, args] = platform === 'darwin'
    ? ['open', [url]]
    : platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]]
  return new Promise(resolve => {
    let child
    try {
      child = spawnFn(command, args, { stdio: 'ignore', detached: false })
    } catch {
      resolve(false)
      return
    }
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      resolve(value)
    }
    child.on?.('error', () => finish(false))
    child.on?.('exit', code => finish(code === 0))
    // Never hold the host open for a browser launcher.
    child.unref?.()
  })
}

function defaultSleep(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    if (typeof timer.unref === 'function') timer.unref()
  })
}

function issuerOf(session) {
  if (typeof session?.oidcIssuer === 'string' && session.oidcIssuer.startsWith('https://')) return session.oidcIssuer
  const scope = typeof session?.scope === 'string' ? session.scope : ''
  const issuer = scope.split('::')[0]
  if (issuer?.startsWith('https://')) return issuer
  return XAI_OAUTH_ISSUER
}

function clientIdOf(session) {
  if (typeof session?.oidcClientId === 'string' && session.oidcClientId) return session.oidcClientId
  const scope = typeof session?.scope === 'string' ? session.scope : ''
  const clientId = scope.split('::')[1]
  return clientId || GROK_OIDC_CLIENT_ID
}

/**
 * Renew the access token with the refresh token stored in auth.json.
 * Returns the renewed session, or undefined when the file has no refresh token.
 * Does not spawn a process.
 */
async function defaultRenewSession(options = {}) {
  const env = options.env ?? process.env
  const path = options.authPath ?? authJsonPath(env)
  const read = options.readAuth ?? (() => readGrokAuthSession(path))
  let parsed
  try {
    parsed = read()
  } catch {
    return undefined
  }
  const current = parsed?.session
  if (!current?.refreshToken) return undefined
  const issuer = issuerOf(current)
  const clientId = clientIdOf(current)
  const fetchImpl = options.fetch ?? fetch
  const endpoints = options.endpoints ?? await discoverOauthEndpoints(issuer, { fetch: fetchImpl })
  const nowMs = typeof options.now === 'function' ? options.now() : Date.now()
  const tokens = await refreshOauthToken({
    endpoint: endpoints.tokenEndpoint,
    clientId,
    refreshToken: current.refreshToken,
    fetch: fetchImpl,
    now: () => nowMs,
  })
  const written = writeOauthSession(path, {
    issuer,
    clientId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || current.refreshToken,
    expiresAt: tokens.expiresAt ?? current.expiresAt,
    email: current.email,
    userId: current.userId,
  })
  return written.session
}

async function defaultCredentialRefOf() {
  try {
    const mod = await optionalImport('@deepseek-ai/dsh-credentials')
    if (typeof mod?.credentialRef === 'function') return mod.credentialRef(CREDENTIAL_REF_NAME)
  } catch {
    // Host without the credentials package still accepts the raw env-style name.
  }
  return CREDENTIAL_REF_NAME
}

function scheduleDeferred(run) {
  if (typeof setImmediate === 'function') setImmediate(run)
  else queueMicrotask(run)
}

export function withTimeout(promise, ms, message, options = {}) {
  let timer
  const shouldUnref = options.unref !== false
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
      // Deferred credential I/O must not pin the event loop if the host is idle.
      // RPC host timeouts keep the timer ref'd so the request cannot evaporate.
      if (shouldUnref && typeof timer?.unref === 'function') timer.unref()
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function createSessionService({
  credentials,
  logger,
  onCatalogChange,
  fetchBillingUsage: fetchBilling = defaultFetchBillingUsage,
  loadCatalog: loadCatalogFn = defaultLoadCatalog,
  readAuth = readGrokAuthSession,
  storeTokenTimeoutMs = STORE_TOKEN_TIMEOUT_MS,
  credentialsIoTimeoutMs = CREDENTIALS_IO_TIMEOUT_MS,
  credentialRefOf = defaultCredentialRefOf,
  renewSession,
  fetch: fetchImpl,
  authPath,
  env,
  oauthEndpoints,
  now = () => Date.now(),
} = {}) {
  const renew = renewSession ?? (() => defaultRenewSession({
    readAuth,
    fetch: fetchImpl,
    authPath,
    env,
    endpoints: oauthEndpoints,
    now,
  }))
  let catalog = { models: [], source: 'signed-out', error: undefined }
  let lastPublic = publicSessionView(undefined)
  let lastUsage = unavailableUsage('Not fetched yet')
  /** In-process access token so Pull/adapters never wait on credentials I/O. */
  let memoryAccessToken
  /** Epoch ms when the in-memory token stops working, when auth.json said so. */
  let memoryTokenExpiresAt
  /** After an in-process Pull/logout touched session memory, skip hanging credentials.resolve. */
  let memorySessionTouched = false

  const resolveTimeoutMs = () => {
    return typeof storeTokenTimeoutMs === 'number' && storeTokenTimeoutMs > 0
      ? storeTokenTimeoutMs
      : STORE_TOKEN_TIMEOUT_MS
  }

  const resolveIoTimeoutMs = () => {
    return typeof credentialsIoTimeoutMs === 'number' && credentialsIoTimeoutMs > 0
      ? credentialsIoTimeoutMs
      : CREDENTIALS_IO_TIMEOUT_MS
  }

  /** auth.json stores `expires_at` as an ISO string; tolerate ms too. */
  const epochMs = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value.trim())
      if (Number.isFinite(parsed)) return parsed
    }
    return undefined
  }

  /** Adopt a session read from auth.json (or a fresh CLI renewal) into memory. */
  const adoptSession = session => {
    if (!session?.accessToken) return undefined
    memoryAccessToken = session.accessToken
    memoryTokenExpiresAt = epochMs(session.expiresAt)
    memorySessionTouched = true
    lastPublic = publicSessionView(session)
    return memoryAccessToken
  }

  /**
   * True when the in-memory token is known to be expired (or about to expire).
   * An unknown expiry is treated as usable: never refresh on a hunch.
   */
  const memoryTokenNeedsRenewal = () => {
    if (typeof memoryAccessToken !== 'string' || memoryAccessToken.length === 0) return false
    if (typeof memoryTokenExpiresAt !== 'number') return false
    return memoryTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS <= now()
  }

  let renewalInFlight
  /**
   * Refresh the access token, then adopt the session auth.json now holds.
   * Concurrent callers share one refresh.
   */
  const renewAccessToken = async () => {
    if (renewalInFlight) return renewalInFlight
    renewalInFlight = (async () => {
      try {
        const session = await renew()
        const token = adoptSession(session)
        if (token) notifyCatalogChange()
        return token
      } catch (error) {
        logger?.warn?.(
          'Grok subscription session renewal failed: %s',
          error instanceof Error ? error.message : 'unknown',
        )
        return undefined
      } finally {
        renewalInFlight = undefined
      }
    })()
    return renewalInFlight
  }

  const notifyCatalogChange = () => {
    // Fail-soft and deferred so llm/adapters-updated listeners cannot re-enter
    // credentials/llm while a Pull/status RPC critical path is still open.
    scheduleDeferred(() => {
      try {
        onCatalogChange?.()
      } catch (error) {
        logger?.warn?.(
          'Grok subscription catalog change notify failed: %s',
          error instanceof Error ? error.message : 'unknown',
        )
      }
    })
  }

  const readStoredToken = async () => {
    if (typeof memoryAccessToken === 'string' && memoryAccessToken.length > 0) {
      if (!memoryTokenNeedsRenewal()) return memoryAccessToken
      // Expired in memory: refresh via the token endpoint and re-read auth.json.
      // Falling back to the stale token keeps the eventual error a real 401
      // rather than a misleading "not signed in".
      const renewed = await renewAccessToken()
      return renewed ?? memoryAccessToken
    }
    // Signed-out pull / logout already cleared memory: do not block adapters on
    // credentialRef/resolve (cold start still falls through when untouched).
    if (memorySessionTouched) return undefined
    if (!credentials?.resolve) return undefined
    const timeoutMs = resolveIoTimeoutMs()
    try {
      const hit = await withTimeout(
        (async () => {
          const ref = await credentialRefOf()
          return credentials.resolve(ref)
        })(),
        timeoutMs,
        `Resolving Grok credential timed out after ${timeoutMs}ms`,
      )
      const value = hit?.value
      return typeof value === 'string' && value.length > 0 ? value : undefined
    } catch (error) {
      logger?.warn?.(
        'Grok subscription credential resolve failed: %s',
        error instanceof Error ? error.message : 'unknown',
      )
      return undefined
    }
  }

  const persistToken = async token => {
    if (!credentials?.set) throw new Error('DSH credentials service is unavailable')
    const timeoutMs = resolveTimeoutMs()
    await withTimeout(
      (async () => {
        const ref = await credentialRefOf()
        await credentials.set(ref, token)
      })(),
      timeoutMs,
      `Storing Grok credential timed out after ${timeoutMs}ms`,
    )
  }

  const clearToken = async () => {
    if (!credentials?.unset) return
    const timeoutMs = resolveTimeoutMs()
    await withTimeout(
      (async () => {
        const ref = await credentialRefOf()
        await credentials.unset(ref)
      })(),
      timeoutMs,
      `Clearing Grok credential timed out after ${timeoutMs}ms`,
    )
  }

  const refreshUsage = async () => {
    const token = await readStoredToken()
    if (!token) {
      lastUsage = unavailableUsage('Not signed in')
      return lastUsage
    }
    try {
      lastUsage = await fetchBilling(token)
    } catch (error) {
      logger?.warn?.(
        'Grok subscription usage fetch failed: %s',
        error instanceof Error ? error.message : 'unknown',
      )
      lastUsage = unavailableUsage('Usage fetch failed')
    }
    return lastUsage
  }

  const refreshCatalog = async () => {
    const token = await readStoredToken()
    if (!token) {
      catalog = { models: [], source: 'signed-out', error: undefined }
      notifyCatalogChange()
      return catalog
    }
    catalog = await loadCatalogFn(token)
    notifyCatalogChange()
    return catalog
  }

  const kickBackgroundUsageRefresh = () => {
    void refreshUsage().catch(error => {
      logger?.warn?.(
        'Grok subscription background usage refresh failed: %s',
        error instanceof Error ? error.message : 'unknown',
      )
    })
  }

  const kickBackgroundCatalogRefresh = () => {
    void refreshCatalog().catch(error => {
      logger?.warn?.(
        'Grok subscription background catalog refresh failed: %s',
        error instanceof Error ? error.message : 'unknown',
      )
    })
  }

  const pull = async () => {
    const parsed = readAuth()
    if (!parsed.session) {
      memoryAccessToken = undefined
      memorySessionTouched = true
      catalog = { models: [], source: 'signed-out', error: undefined }
      lastPublic = publicSessionView(undefined)
      lastUsage = unavailableUsage('Not signed in')
      scheduleDeferred(() => {
        void clearToken().catch(error => {
          logger?.warn?.(
            'Grok subscription deferred credential clear failed: %s',
            error instanceof Error ? error.message : 'unknown',
          )
        })
      })
      const message = parsed.reason === 'api-key-only'
        ? 'Found an API-key entry only. Sign in with a SuperGrok / X Premium account.'
        : 'No Grok Build subscription session in auth.json. Sign in from Settings first.'
      notifyCatalogChange()
      return { ok: false, error: message, account: lastPublic, catalog, usage: lastUsage }
    }
    // Critical path: local auth.json + in-memory token only. Credentials persist
    // and catalog/usage network work are deferred / backgrounded.
    const accessToken = parsed.session.accessToken
    memoryAccessToken = accessToken
    memoryTokenExpiresAt = epochMs(parsed.session.expiresAt)
    memorySessionTouched = true
    lastPublic = publicSessionView(parsed.session)
    scheduleDeferred(() => {
      void persistToken(accessToken).catch(error => {
        logger?.warn?.(
          'Grok subscription deferred credential persist failed: %s',
          error instanceof Error ? error.message : 'unknown',
        )
      })
    })
    notifyCatalogChange()
    kickBackgroundCatalogRefresh()
    kickBackgroundUsageRefresh()
    return { ok: true, account: lastPublic, catalog, usage: lastUsage }
  }

  const snapshot = () => ({ account: lastPublic, catalog, usage: lastUsage, authPath: authPath ?? authJsonPath(env) })

  const status = async () => {
    // Prefer memory / last successful Pull so a slow credentials.resolve cannot
    // force a signed-out flash after an in-process signed-in session.
    if ((typeof memoryAccessToken === 'string' && memoryAccessToken.length > 0) || lastPublic.signedIn === true) {
      return snapshot()
    }

    // Same spirit as pull: auth.json first (sync), never block Settings on credentials.
    try {
      const parsed = readAuth()
      if (parsed.session) {
        adoptSession(parsed.session)
        return snapshot()
      }
    } catch (error) {
      logger?.warn?.(
        'Grok subscription auth.json read failed during status: %s',
        error instanceof Error ? error.message : 'unknown',
      )
    }

    let token
    try {
      token = await readStoredToken()
    } catch (error) {
      logger?.warn?.('could not resolve Grok subscription credential: %s', error instanceof Error ? error.message : 'unknown')
      token = undefined
    }
    if (!token) {
      lastPublic = publicSessionView(undefined)
      catalog = { models: [], source: 'signed-out', error: undefined }
      lastUsage = unavailableUsage('Not signed in')
      return snapshot()
    }
    memoryAccessToken = token
    lastPublic = Object.freeze({ signedIn: true, maskedAccount: '••••', authMode: 'oidc', source: 'dsh-credentials' })
    // Return cached usage only. Billing is fetched via usage/refresh (or the
    // background post-pull kick) — never on every Settings status load.
    return snapshot()
  }

  let loginEpoch = 0
  const login = async loginOptions => {
    const epoch = ++loginEpoch
    const fetchLogin = loginOptions?.fetch ?? fetchImpl ?? fetch
    const path = loginOptions?.authPath ?? authPath ?? authJsonPath(env)
    const sleep = loginOptions?.sleep ?? defaultSleep
    const openUrl = loginOptions?.openUrl ?? (url => openExternal(url, { spawn: loginOptions?.openSpawn }))
    const clock = () => (typeof loginOptions?.now === 'function' ? loginOptions.now() : now())
    let endpoints
    let device
    try {
      endpoints = loginOptions?.endpoints ?? oauthEndpoints ?? await discoverOauthEndpoints(XAI_OAUTH_ISSUER, { fetch: fetchLogin })
      device = await requestDeviceAuthorization({
        endpoint: endpoints.deviceAuthorizationEndpoint,
        fetch: fetchLogin,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start sign-in'
      return { ok: false, error: message, ...(await status()) }
    }
    const loginUrl = device.verificationUriComplete || device.verificationUri
    if (!isXaiHttpsUrl(loginUrl) || !device.userCode || !device.deviceCode) {
      return { ok: false, error: 'Sign-in did not return a verification link.', ...(await status()) }
    }
    try {
      void openUrl(loginUrl)
    } catch {
      // The panel still shows the link.
    }
    const deadline = clock() + (typeof device.expiresIn === 'number' && device.expiresIn > 0 ? device.expiresIn : 900) * 1000
    let interval = Number.isFinite(device.interval) && device.interval >= 0 ? device.interval : 5
    const poll = async () => {
      try {
        while (epoch === loginEpoch) {
          if (clock() >= deadline) {
            logger?.warn?.('Grok subscription sign-in timed out before authorization')
            return
          }
          await sleep(interval * 1000)
          if (epoch !== loginEpoch) return
          const result = await exchangeDeviceCode({
            endpoint: endpoints.tokenEndpoint,
            deviceCode: device.deviceCode,
            fetch: fetchLogin,
            now: clock,
          })
          if (epoch !== loginEpoch) return
          if (result.kind === 'pending') continue
          if (result.kind === 'slow_down') {
            interval += 5
            continue
          }
          if (result.kind !== 'ok') {
            logger?.warn?.('Grok subscription sign-in stopped: %s', result.error ?? 'unknown')
            return
          }
          writeOauthSession(path, {
            issuer: result.issuer,
            clientId: result.clientId,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: result.expiresAt,
          })
          if (epoch !== loginEpoch) return
          await pull()
          return
        }
      } catch (error) {
        logger?.warn?.(
          'Grok subscription sign-in failed: %s',
          error instanceof Error ? error.message : 'unknown',
        )
      } finally {
        try {
          loginOptions?.onSettled?.()
        } catch {
          // A test hook must not turn into a failed sign-in.
        }
      }
    }
    void poll()
    return { ok: true, pending: true, loginUrl, userCode: device.userCode, ...(await status()) }
  }

  const logout = async () => {
    loginEpoch += 1
    memoryAccessToken = undefined
    memorySessionTouched = true
    await clearToken().catch(error => {
      logger?.warn?.(
        'Grok subscription credential clear failed: %s',
        error instanceof Error ? error.message : 'unknown',
      )
    })
    catalog = { models: [], source: 'signed-out', error: undefined }
    lastPublic = publicSessionView(undefined)
    lastUsage = unavailableUsage('Not signed in')
    notifyCatalogChange()
    return { ok: true, account: lastPublic, catalog, usage: lastUsage }
  }

  return {
    pull,
    status,
    refreshCatalog,
    refreshUsage,
    login,
    logout,
    currentToken: readStoredToken,
    /** Force a refresh-token renewal; used when the provider answers 401. */
    refreshToken: () => renewAccessToken(),
    models: () => catalog.models,
    catalog: () => catalog,
    usage: () => lastUsage,
    publicAccount: () => lastPublic,
  }
}
