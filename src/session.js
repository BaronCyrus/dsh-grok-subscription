import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { CREDENTIAL_REF_NAME } from './constants.js'
import { authJsonPath, grokHome, publicSessionView, readGrokAuthSession } from './auth-file.js'
import { loadCatalog } from './catalog.js'

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

async function credentialRefOf() {
  try {
    const mod = await import('@deepseek-ai/dsh-credentials')
    if (typeof mod.credentialRef === 'function') return mod.credentialRef(CREDENTIAL_REF_NAME)
  } catch {
    // Host without the credentials package still accepts the raw env-style name.
  }
  return CREDENTIAL_REF_NAME
}

export function createSessionService({ credentials, logger, onCatalogChange } = {}) {
  let catalog = { models: [], source: 'signed-out', error: undefined }
  let lastPublic = publicSessionView(undefined)

  const notifyCatalogChange = () => {
    try {
      onCatalogChange?.()
    } catch (error) {
      logger?.warn?.(
        'Grok subscription catalog change notify failed: %s',
        error instanceof Error ? error.message : 'unknown',
      )
    }
  }

  const readStoredToken = async () => {
    if (!credentials?.resolve) return undefined
    const hit = await credentials.resolve(await credentialRefOf())
    const value = hit?.value
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  const storeToken = async token => {
    if (!credentials?.set) throw new Error('DSH credentials service is unavailable')
    await credentials.set(await credentialRefOf(), token)
  }

  const clearToken = async () => {
    if (!credentials?.unset) return
    await credentials.unset(await credentialRefOf())
  }

  const pull = async () => {
    const parsed = readGrokAuthSession()
    if (!parsed.session) {
      catalog = { models: [], source: 'signed-out', error: undefined }
      lastPublic = publicSessionView(undefined)
      await clearToken()
      const message = parsed.reason === 'api-key-only'
        ? 'Found an API-key entry only. Sign in with SuperGrok / X Premium via grok login.'
        : 'No Grok Build subscription session in auth.json. Run grok login first.'
      notifyCatalogChange()
      return { ok: false, error: message, account: lastPublic, catalog }
    }
    await storeToken(parsed.session.accessToken)
    lastPublic = publicSessionView(parsed.session)
    catalog = await loadCatalog(parsed.session.accessToken)
    notifyCatalogChange()
    return { ok: true, account: lastPublic, catalog }
  }

  const status = async () => {
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
      return { account: lastPublic, catalog, cliAvailable: grokCliAvailable(), authPath: authJsonPath() }
    }
    if (lastPublic.signedIn !== true) {
      try {
        const parsed = readGrokAuthSession()
        if (parsed.session) lastPublic = publicSessionView(parsed.session)
        else lastPublic = Object.freeze({ signedIn: true, maskedAccount: '••••', authMode: 'oidc', source: 'dsh-credentials' })
      } catch {
        lastPublic = Object.freeze({ signedIn: true, maskedAccount: '••••', authMode: 'oidc', source: 'dsh-credentials' })
      }
    }
    return { account: lastPublic, catalog, cliAvailable: grokCliAvailable(), authPath: authJsonPath() }
  }

  const refreshCatalog = async () => {
    const token = await readStoredToken()
    if (!token) {
      catalog = { models: [], source: 'signed-out', error: undefined }
      notifyCatalogChange()
      return catalog
    }
    catalog = await loadCatalog(token)
    notifyCatalogChange()
    return catalog
  }

  const login = async options => {
    await spawnGrokLogin(options)
    return pull()
  }

  const logout = async () => {
    await clearToken()
    catalog = { models: [], source: 'signed-out', error: undefined }
    lastPublic = publicSessionView(undefined)
    notifyCatalogChange()
    return { ok: true, account: lastPublic, catalog }
  }

  return {
    pull,
    status,
    refreshCatalog,
    login,
    logout,
    currentToken: readStoredToken,
    models: () => catalog.models,
    catalog: () => catalog,
    publicAccount: () => lastPublic,
  }
}
