import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import {
  CLI_REFRESH_TIMEOUT_MS,
  CREDENTIAL_REF_NAME,
  CREDENTIALS_IO_TIMEOUT_MS,
  STORE_TOKEN_TIMEOUT_MS,
  TOKEN_EXPIRY_SKEW_MS,
} from './constants.js'
import { authJsonPath, grokHome, publicSessionView, readGrokAuthSession } from './auth-file.js'
import { loadCatalog as defaultLoadCatalog } from './catalog.js'
import { fetchBillingUsage as defaultFetchBillingUsage, unavailableUsage } from './usage.js'
import { optionalImport } from './adapter.js'

export function resolveGrokBin(env = process.env, exists = existsSync) {
  if (typeof env.DSH_GROK_BIN === 'string' && env.DSH_GROK_BIN.trim()) return env.DSH_GROK_BIN.trim()
  const local = join(grokHome(env), 'bin', 'grok')
  if (exists(local)) return local
  return 'grok'
}

export function grokCliAvailable(env = process.env, exists = existsSync) {
  const bin = resolveGrokBin(env, exists)
  if (bin.includes('/') || bin.includes('\\')) return exists(bin)
  const delimiter = process.platform === 'win32' ? ';' : ':'
  return String(env.PATH ?? '').split(delimiter).some(dir => dir && exists(join(dir, bin)))
}

export function spawnGrokLogin(options = {}) {
  const spawnFn = options.spawn ?? spawn
  const bin = resolveGrokBin(options.env, options.exists)
  const args = options.device ? ['login', '--device-auth'] : ['login']
  return new Promise((resolve, reject) => {
    const child = spawnFn(bin, args, {
      stdio: options.stdio ?? 'inherit',
      env: options.env ?? process.env,
    })
    child.on('error', error => {
      reject(new Error(`Could not start grok CLI (${bin})`, { cause: error }))
    })
    child.on('exit', (code, signal) => {
      if (code === 0) resolve({ ok: true, code })
      else reject(new Error(signal ? `grok login terminated by ${signal}` : `grok login exited with code ${code ?? 'unknown'}`))
    })
  })
}

/**
 * Lets the official CLI renew its own session. `grok models` is the cheapest
 * command that goes through the CLI's refresh path: it exits in well under a
 * second when the token is still valid, and rewrites auth.json when it is not.
 *
 * The CLI prints "You are not authenticated." even when it *did* refresh, so the
 * exit status says nothing useful — callers must re-read auth.json and compare.
 */
export function spawnGrokRefresh(options = {}) {
  const spawnFn = options.spawn ?? spawn
  const bin = resolveGrokBin(options.env, options.exists)
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : CLI_REFRESH_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawnFn(bin, ['models'], {
        stdio: options.stdio ?? 'ignore',
        env: options.env ?? process.env,
      })
    } catch (error) {
      reject(new Error(`Could not start grok CLI (${bin})`, { cause: error }))
      return
    }
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill('SIGKILL')
      } catch {
        // Best effort: the timeout still resolves as a failed refresh.
      }
      resolve({ ok: false, reason: 'timeout' })
    }, timeoutMs)
    child.on('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`Could not run grok CLI (${bin})`, { cause: error }))
    })
    child.on('exit', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Exit status is not a reliable success signal; the caller re-reads auth.json.
      resolve({ ok: true, code })
    })
  })
}

/**
 * Default renewal: hand off to the official CLI, then re-read auth.json.
 * Returns the renewed session, or undefined when the CLI is unavailable or the
 * file still holds the old token.
 */
async function defaultRenewSession(options = {}) {
  const env = options.env ?? process.env
  if (!grokCliAvailable(env)) return undefined
  await spawnGrokRefresh({ env })
  const parsed = (options.readAuth ?? readGrokAuthSession)()
  return parsed?.session
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
  renewSession = defaultRenewSession,
  now = () => Date.now(),
} = {}) {
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
   * An unknown expiry is treated as usable: never force a CLI spawn on a hunch.
   */
  const memoryTokenNeedsRenewal = () => {
    if (typeof memoryAccessToken !== 'string' || memoryAccessToken.length === 0) return false
    if (typeof memoryTokenExpiresAt !== 'number') return false
    return memoryTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS <= now()
  }

  let renewalInFlight
  /**
   * Ask the official CLI to renew, then re-read auth.json. Concurrent callers
   * (several sessions hitting the same expired token) share one spawn.
   */
  const renewAccessToken = async () => {
    if (renewalInFlight) return renewalInFlight
    renewalInFlight = (async () => {
      try {
        const session = await renewSession()
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
      // Expired in memory: the CLI owns renewal, so let it rewrite auth.json and
      // re-read. Falling back to the stale token keeps the eventual error a real
      // 401 rather than a misleading "not signed in".
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
        ? 'Found an API-key entry only. Sign in with SuperGrok / X Premium via grok login.'
        : 'No Grok Build subscription session in auth.json. Run grok login first.'
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

  const status = async () => {
    // Prefer memory / last successful Pull so a slow credentials.resolve cannot
    // force a signed-out flash after an in-process signed-in session.
    if ((typeof memoryAccessToken === 'string' && memoryAccessToken.length > 0) || lastPublic.signedIn === true) {
      return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() }
    }

    // Same spirit as pull: auth.json first (sync), never block Settings on credentials.
    try {
      const parsed = readAuth()
      if (parsed.session) {
        adoptSession(parsed.session)
        return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() }
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
      return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() }
    }
    memoryAccessToken = token
    lastPublic = Object.freeze({ signedIn: true, maskedAccount: '••••', authMode: 'oidc', source: 'dsh-credentials' })
    // Return cached usage only. Billing is fetched via usage/refresh (or the
    // background post-pull kick) — never on every Settings status load.
    return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() }
  }

  const login = async options => {
    await spawnGrokLogin(options)
    return pull()
  }

  const logout = async () => {
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
    /** Force a CLI-backed renewal; used when the provider answers 401. */
    refreshToken: () => renewAccessToken(),
    models: () => catalog.models,
    catalog: () => catalog,
    usage: () => lastUsage,
    publicAccount: () => lastPublic,
  }
}
