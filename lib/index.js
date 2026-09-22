// src/constants.js
var CORDIS_ID = "grok-subscription";
var PROVIDER_ID = "grok-build";
var DISPLAY_NAME = "Grok Build (subscription)";
var DISPLAY_NAME_ZH = "Grok \u8BA2\u9605";
var SETTINGS_NAMESPACE = "grokSubscription";
var CREDENTIAL_REF_NAME = "GROK_BUILD_ACCESS_TOKEN";
var PROXY_BASE_URL = "https://cli-chat-proxy.grok.com/v1";
var RESPONSES_URL = "https://cli-chat-proxy.grok.com/v1/responses";
var MODELS_V2_URL = "https://cli-chat-proxy.grok.com/v1/models-v2";
var TOKEN_AUTH_HEADER = "X-XAI-Token-Auth";
var TOKEN_AUTH_VALUE = "xai-grok-cli";
var CLIENT_IDENTIFIER_HEADER = "x-grok-client-identifier";
var CLIENT_VERSION_HEADER = "x-grok-client-version";
var CLIENT_IDENTIFIER = "grok-shell";
var CLIENT_VERSION_FALLBACK = "1.0.5";
var API_KEY_SCOPE = "xai::api_key";
var SESSION_AUTH_MODES = Object.freeze(["oidc", "external", "web_login", "grok"]);
var API_KEY_AUTH_MODES = Object.freeze(["api_key"]);
var AUTH_FILE_MAX_BYTES = 1048576;
var CATALOG_TIMEOUT_MS = 15e3;
var STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1e3;
var MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
var FALLBACK_MODEL_IDS = Object.freeze(["grok-4.7", "grok-4.6", "grok-4.5"]);

// src/session.js
import { existsSync as existsSync2 } from "node:fs";
import { spawn } from "node:child_process";
import { join as join2 } from "node:path";

// src/auth-file.js
import { lstatSync, openSync, readFileSync, closeSync, constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var XAI_OAUTH_ISSUER = "https://auth.x.ai";
function grokHome(env = process.env) {
  const override = typeof env.GROK_HOME === "string" && env.GROK_HOME.trim() ? env.GROK_HOME.trim() : void 0;
  return override ?? join(homedir(), ".grok");
}
function authJsonPath(env = process.env) {
  if (typeof env.DSH_GROK_AUTH_PATH === "string" && env.DSH_GROK_AUTH_PATH.trim()) {
    return env.DSH_GROK_AUTH_PATH.trim();
  }
  return join(grokHome(env), "auth.json");
}
function versionJsonPath(env = process.env) {
  if (typeof env.DSH_GROK_VERSION_PATH === "string" && env.DSH_GROK_VERSION_PATH.trim()) {
    return env.DSH_GROK_VERSION_PATH.trim();
  }
  return join(grokHome(env), "version.json");
}
function inspectAuthFileSafety(meta, options = {}) {
  const platform = options.platform ?? process.platform;
  const currentUid = options.uid ?? process.getuid?.();
  if (meta.isSymbolicLink) {
    throw new Error("Refusing to read a symbolic-link Grok auth.json");
  }
  if (!meta.isFile) {
    throw new Error("Grok auth.json is not a regular file");
  }
  if (typeof meta.size === "number" && meta.size > AUTH_FILE_MAX_BYTES) {
    throw new Error("Grok auth.json is larger than the allowed size");
  }
  if (platform === "win32") return;
  if (typeof meta.mode === "number" && (meta.mode & 63) !== 0) {
    throw new Error("Grok auth.json must be owner-only (chmod 600); group/other access is refused");
  }
  if (typeof currentUid === "number" && typeof meta.uid === "number" && meta.uid !== currentUid) {
    throw new Error("Grok auth.json is not owned by the current user");
  }
}
function readSecureJsonFile(path, options = {}) {
  const lstat = options.lstat ?? ((target) => lstatSync(target, { throwIfNoEntry: false }));
  const read = options.read ?? ((target) => {
    const fd = openSync(target, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    try {
      return readFileSync(fd, "utf8");
    } finally {
      closeSync(fd);
    }
  });
  const stat = lstat(path);
  if (!stat) throw new Error(`Grok file not found: ${path}`);
  inspectAuthFileSafety({
    isSymbolicLink: typeof stat.isSymbolicLink === "function" ? stat.isSymbolicLink() : Boolean(stat.isSymbolicLink),
    isFile: typeof stat.isFile === "function" ? stat.isFile() : Boolean(stat.isFile),
    mode: stat.mode,
    uid: stat.uid,
    size: stat.size
  }, options);
  const text = read(path);
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Grok auth document is empty");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Grok auth document is not valid JSON", { cause: error });
  }
}
function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function normalizeAuthMode(value) {
  if (typeof value !== "string") return void 0;
  return value.trim().toLowerCase();
}
function accessTokenFromEntry(entry) {
  if (typeof entry === "string") return asNonEmptyString(entry);
  if (!entry || typeof entry !== "object") return void 0;
  return asNonEmptyString(entry.key) ?? asNonEmptyString(entry.access_token) ?? asNonEmptyString(entry.accessToken);
}
function isApiKeyOnlyEntry(entry, scope) {
  if (scope === API_KEY_SCOPE) return true;
  if (typeof entry === "string") return false;
  if (!entry || typeof entry !== "object") return true;
  const mode = normalizeAuthMode(entry.auth_mode ?? entry.authMode);
  if (mode && API_KEY_AUTH_MODES.includes(mode)) return true;
  if (mode && SESSION_AUTH_MODES.includes(mode)) return false;
  const token = accessTokenFromEntry(entry);
  const refresh = asNonEmptyString(entry.refresh_token ?? entry.refreshToken);
  const issuer = asNonEmptyString(entry.oidc_issuer ?? entry.oidcIssuer);
  if (token && (refresh || issuer || mode)) return false;
  if (token && !refresh && !issuer && !mode) return true;
  return !token;
}
function maskAccount(value) {
  if (typeof value !== "string" || value.trim() === "") return void 0;
  const text = value.trim();
  if (!text.includes("@")) {
    if (text.length <= 2) return `${text[0] ?? ""}\u2022`;
    return `${text[0]}\u2022\u2022\u2022${text.at(-1)}`;
  }
  const [local, domain] = text.split("@", 2);
  if (!domain) return "\u2022\u2022\u2022\u2022";
  if (local.length <= 2) return `${local.slice(0, 1)}\u2022\u2022@${domain}`;
  return `${local[0]}\u2022\u2022\u2022${local.at(-1)}@${domain}`;
}
function sessionFromEntry(scope, entry) {
  if (isApiKeyOnlyEntry(entry, scope)) return void 0;
  const token = accessTokenFromEntry(entry);
  if (!token) return void 0;
  const object = entry && typeof entry === "object" ? entry : {};
  const email = asNonEmptyString(object.email);
  const userId = asNonEmptyString(object.user_id ?? object.userId);
  const expiresAt = asNonEmptyString(object.expires_at ?? object.expiresAt);
  const authMode = normalizeAuthMode(object.auth_mode ?? object.authMode) ?? "oidc";
  return Object.freeze({
    scope,
    accessToken: token,
    authMode,
    email,
    userId,
    expiresAt,
    maskedAccount: maskAccount(email) ?? maskAccount(userId)
  });
}
function preferredScopeScore(scope, entry) {
  const issuer = entry && typeof entry === "object" ? asNonEmptyString(entry.oidc_issuer ?? entry.oidcIssuer) : void 0;
  if (typeof scope === "string" && scope.startsWith(`${XAI_OAUTH_ISSUER}::`)) return 3;
  if (issuer === XAI_OAUTH_ISSUER) return 2;
  if (SESSION_AUTH_MODES.includes(normalizeAuthMode(entry?.auth_mode ?? entry?.authMode) ?? "")) return 1;
  return 0;
}
function parseAuthDocument(document) {
  if (Array.isArray(document)) {
    return { session: void 0, reason: "unsupported-shape" };
  }
  if (!document || typeof document !== "object") {
    return { session: void 0, reason: "invalid-document" };
  }
  if (asNonEmptyString(document.access_token) || asNonEmptyString(document.key)) {
    const session = sessionFromEntry("document", document);
    if (session) return { session, reason: void 0 };
    if (isApiKeyOnlyEntry(document, document.scope)) {
      return { session: void 0, reason: "api-key-only" };
    }
  }
  const candidates = [];
  let sawApiKey = false;
  for (const [scope, entry] of Object.entries(document)) {
    if (isApiKeyOnlyEntry(entry, scope)) {
      sawApiKey = true;
      continue;
    }
    const session = sessionFromEntry(scope, entry);
    if (session) candidates.push(session);
  }
  if (candidates.length === 0) {
    return { session: void 0, reason: sawApiKey ? "api-key-only" : "no-session" };
  }
  candidates.sort((a, b) => preferredScopeScore(b.scope, document[b.scope]) - preferredScopeScore(a.scope, document[a.scope]));
  return { session: candidates[0], reason: void 0 };
}
function readGrokAuthSession(path = authJsonPath(), options = {}) {
  const document = readSecureJsonFile(path, options);
  return parseAuthDocument(document);
}
function publicSessionView(session) {
  if (!session) {
    return Object.freeze({
      signedIn: false,
      maskedAccount: void 0,
      authMode: void 0,
      source: void 0
    });
  }
  return Object.freeze({
    signedIn: true,
    maskedAccount: session.maskedAccount,
    authMode: session.authMode,
    expiresAt: session.expiresAt,
    source: "grok-cli"
  });
}

// src/headers.js
import { readFileSync as readFileSync2, existsSync } from "node:fs";
function parseClientVersion(document) {
  if (typeof document === "string" && document.trim()) return document.trim();
  if (!document || typeof document !== "object") return void 0;
  for (const key of ["version", "cliVersion", "cli_version", "grokVersion"]) {
    if (typeof document[key] === "string" && document[key].trim()) return document[key].trim();
  }
  if (document.grok && typeof document.grok === "object" && typeof document.grok.version === "string") {
    return document.grok.version.trim();
  }
  return void 0;
}
function readClientVersion(env = process.env, options = {}) {
  if (typeof env.DSH_GROK_CLIENT_VERSION === "string" && env.DSH_GROK_CLIENT_VERSION.trim()) {
    return env.DSH_GROK_CLIENT_VERSION.trim();
  }
  const path = options.path ?? versionJsonPath(env);
  const exists = options.exists ?? existsSync;
  const read = options.read ?? ((target) => readFileSync2(target, "utf8"));
  if (!exists(path)) return CLIENT_VERSION_FALLBACK;
  try {
    const parsed = parseClientVersion(JSON.parse(read(path)));
    return parsed ?? CLIENT_VERSION_FALLBACK;
  } catch {
    return CLIENT_VERSION_FALLBACK;
  }
}
function fingerprintHeaders(options = {}) {
  const identifier = options.identifier ?? CLIENT_IDENTIFIER;
  const version = options.version ?? readClientVersion(options.env, options);
  return Object.freeze({
    [TOKEN_AUTH_HEADER]: TOKEN_AUTH_VALUE,
    [CLIENT_IDENTIFIER_HEADER]: identifier,
    [CLIENT_VERSION_HEADER]: version
  });
}
function buildProxyHeaders(accessToken, options = {}) {
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("A Grok Build access token is required to build proxy headers");
  }
  return Object.freeze({
    Authorization: `Bearer ${accessToken}`,
    ...fingerprintHeaders(options)
  });
}

// src/catalog.js
var REASONING_LEVELS = Object.freeze(["low", "medium", "high", "xhigh"]);
function asId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function rowsFromBody(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.models)) return body.models;
  if (Array.isArray(body.items)) return body.items;
  return [];
}
function contextWindowOf(row) {
  const value = row.contextWindow ?? row.context_window ?? row.context ?? row.max_context;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : void 0;
}
function reasoningEffortsOf(row) {
  const raw = row.reasoning_efforts ?? row.reasoningEfforts ?? row.supported_reasoning_efforts;
  if (!Array.isArray(raw)) return void 0;
  const levels = raw.map((item) => typeof item === "string" ? item.trim().toLowerCase() : void 0).filter((item) => REASONING_LEVELS.includes(item));
  return levels.length ? [...new Set(levels)] : void 0;
}
function displayNameOf(id, row) {
  if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  return id.replace(/^grok-/, "Grok ").replace(/\b\w/g, (char) => char.toUpperCase()).replace("Grok ", "Grok ");
}
function extractLiveModels(body) {
  const seen = /* @__PURE__ */ new Set();
  const models = [];
  for (const row of rowsFromBody(body)) {
    const id = typeof row === "string" ? asId(row) : asId(row?.id ?? row?.model ?? row?.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const object = row && typeof row === "object" ? row : { id };
    models.push(Object.freeze({
      id,
      name: displayNameOf(id, object),
      contextWindow: contextWindowOf(object) ?? 5e5,
      maxTokens: contextWindowOf(object) ?? 5e5,
      reasoning: object.reasoning !== false,
      reasoningEfforts: reasoningEffortsOf(object)
    }));
  }
  return models;
}
function fallbackModels() {
  return FALLBACK_MODEL_IDS.map((id) => Object.freeze({
    id,
    name: id === "grok-4.7" ? "Grok 4.7" : id === "grok-4.6" ? "Grok 4.6" : "Grok 4.5",
    contextWindow: 5e5,
    maxTokens: 5e5,
    reasoning: true,
    reasoningEfforts: id === "grok-4.5" ? ["low", "medium", "high"] : ["low", "medium", "high", "xhigh"],
    source: "fallback"
  }));
}
function mergeCatalog(live) {
  if (!Array.isArray(live) || live.length === 0) {
    return fallbackModels().map((model) => ({ ...model }));
  }
  return live.map((model) => ({ ...model, source: "live" }));
}
function toPiModels(models) {
  return models.map((model) => {
    const efforts = model.reasoningEfforts ?? ["low", "medium", "high", "xhigh"];
    const thinkingLevelMap = {
      off: null,
      minimal: null,
      low: efforts.includes("low") ? "low" : null,
      medium: efforts.includes("medium") ? "medium" : null,
      high: efforts.includes("high") ? "high" : null,
      xhigh: efforts.includes("xhigh") ? "xhigh" : null,
      max: null
    };
    return {
      id: model.id,
      name: model.name,
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: PROXY_BASE_URL,
      reasoning: model.reasoning !== false,
      thinkingLevelMap,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.contextWindow ?? 5e5,
      maxTokens: model.maxTokens ?? 5e5,
      compat: { supportsLongCacheRetention: false, supportsDeveloperRole: false }
    };
  });
}
function toLlmModels(models) {
  return models.map((model) => ({
    provider: PROVIDER_ID,
    id: model.id,
    name: model.name,
    inputModalities: ["text"]
  }));
}
async function fetchLiveCatalog(accessToken, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? CATALOG_TIMEOUT_MS);
  const response = await fetchImpl(MODELS_V2_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildProxyHeaders(accessToken, options)
    },
    redirect: "error",
    signal
  });
  if (!response.ok) {
    throw new Error(`Grok models-v2 returned HTTP ${response.status}`);
  }
  const body = await response.json();
  return extractLiveModels(body);
}
async function loadCatalog(accessToken, options = {}) {
  if (!accessToken) {
    return { models: [], source: "signed-out", error: void 0 };
  }
  try {
    const live = await fetchLiveCatalog(accessToken, options);
    if (live.length === 0) {
      return { models: mergeCatalog([]), source: "fallback", error: "Live models-v2 listing was empty" };
    }
    return { models: mergeCatalog(live), source: "live", error: void 0 };
  } catch (error) {
    return {
      models: mergeCatalog([]),
      source: "fallback",
      error: error instanceof Error ? error.message : "Could not refresh Grok model catalog"
    };
  }
}

// src/session.js
function resolveGrokBin(env = process.env, exists = existsSync2) {
  if (typeof env.DSH_GROK_BIN === "string" && env.DSH_GROK_BIN.trim()) return env.DSH_GROK_BIN.trim();
  const local = join2(grokHome(env), "bin", "grok");
  if (exists(local)) return local;
  return "grok";
}
function grokCliAvailable(env = process.env, exists = existsSync2) {
  const bin = resolveGrokBin(env, exists);
  if (bin.includes("/") || bin.includes("\\")) return exists(bin);
  const delimiter = process.platform === "win32" ? ";" : ":";
  return String(env.PATH ?? "").split(delimiter).some((dir) => dir && exists(join2(dir, bin)));
}
function spawnGrokLogin(options = {}) {
  const spawnFn = options.spawn ?? spawn;
  const bin = resolveGrokBin(options.env, options.exists);
  const args = options.device ? ["login", "--device-auth"] : ["login"];
  return new Promise((resolve, reject) => {
    const child = spawnFn(bin, args, {
      stdio: options.stdio ?? "inherit",
      env: options.env ?? process.env
    });
    child.on("error", (error) => {
      reject(new Error(`Could not start grok CLI (${bin})`, { cause: error }));
    });
    child.on("exit", (code, signal) => {
      if (code === 0) resolve({ ok: true, code });
      else reject(new Error(signal ? `grok login terminated by ${signal}` : `grok login exited with code ${code ?? "unknown"}`));
    });
  });
}
async function credentialRefOf() {
  try {
    const mod = await import("@deepseek-ai/dsh-credentials");
    if (typeof mod.credentialRef === "function") return mod.credentialRef(CREDENTIAL_REF_NAME);
  } catch {
  }
  return CREDENTIAL_REF_NAME;
}
function createSessionService({ credentials, logger, onCatalogChange } = {}) {
  let catalog = { models: [], source: "signed-out", error: void 0 };
  let lastPublic = publicSessionView(void 0);
  const notifyCatalogChange = () => {
    try {
      onCatalogChange?.();
    } catch (error) {
      logger?.warn?.(
        "Grok subscription catalog change notify failed: %s",
        error instanceof Error ? error.message : "unknown"
      );
    }
  };
  const readStoredToken = async () => {
    if (!credentials?.resolve) return void 0;
    const hit = await credentials.resolve(await credentialRefOf());
    const value = hit?.value;
    return typeof value === "string" && value.length > 0 ? value : void 0;
  };
  const storeToken = async (token) => {
    if (!credentials?.set) throw new Error("DSH credentials service is unavailable");
    await credentials.set(await credentialRefOf(), token);
  };
  const clearToken = async () => {
    if (!credentials?.unset) return;
    await credentials.unset(await credentialRefOf());
  };
  const pull = async () => {
    const parsed = readGrokAuthSession();
    if (!parsed.session) {
      catalog = { models: [], source: "signed-out", error: void 0 };
      lastPublic = publicSessionView(void 0);
      await clearToken();
      const message = parsed.reason === "api-key-only" ? "Found an API-key entry only. Sign in with SuperGrok / X Premium via grok login." : "No Grok Build subscription session in auth.json. Run grok login first.";
      notifyCatalogChange();
      return { ok: false, error: message, account: lastPublic, catalog };
    }
    await storeToken(parsed.session.accessToken);
    lastPublic = publicSessionView(parsed.session);
    catalog = await loadCatalog(parsed.session.accessToken);
    notifyCatalogChange();
    return { ok: true, account: lastPublic, catalog };
  };
  const status = async () => {
    let token;
    try {
      token = await readStoredToken();
    } catch (error) {
      logger?.warn?.("could not resolve Grok subscription credential: %s", error instanceof Error ? error.message : "unknown");
      token = void 0;
    }
    if (!token) {
      lastPublic = publicSessionView(void 0);
      catalog = { models: [], source: "signed-out", error: void 0 };
      return { account: lastPublic, catalog, cliAvailable: grokCliAvailable(), authPath: authJsonPath() };
    }
    if (lastPublic.signedIn !== true) {
      try {
        const parsed = readGrokAuthSession();
        if (parsed.session) lastPublic = publicSessionView(parsed.session);
        else lastPublic = Object.freeze({ signedIn: true, maskedAccount: "\u2022\u2022\u2022\u2022", authMode: "oidc", source: "dsh-credentials" });
      } catch {
        lastPublic = Object.freeze({ signedIn: true, maskedAccount: "\u2022\u2022\u2022\u2022", authMode: "oidc", source: "dsh-credentials" });
      }
    }
    return { account: lastPublic, catalog, cliAvailable: grokCliAvailable(), authPath: authJsonPath() };
  };
  const refreshCatalog = async () => {
    const token = await readStoredToken();
    if (!token) {
      catalog = { models: [], source: "signed-out", error: void 0 };
      notifyCatalogChange();
      return catalog;
    }
    catalog = await loadCatalog(token);
    notifyCatalogChange();
    return catalog;
  };
  const login = async (options) => {
    await spawnGrokLogin(options);
    return pull();
  };
  const logout = async () => {
    await clearToken();
    catalog = { models: [], source: "signed-out", error: void 0 };
    lastPublic = publicSessionView(void 0);
    notifyCatalogChange();
    return { ok: true, account: lastPublic, catalog };
  };
  return {
    pull,
    status,
    refreshCatalog,
    login,
    logout,
    currentToken: readStoredToken,
    models: () => catalog.models,
    catalog: () => catalog,
    publicAccount: () => lastPublic
  };
}

// src/rpc-contract.js
var RPC_ENDPOINTS = Object.freeze([
  "status",
  "login/cli",
  "login/device",
  "pull",
  "logout",
  "catalog/refresh"
]);
function publicResult(value) {
  return { ok: true, value };
}
function publicError(error, fallback = "Grok subscription request failed") {
  const message = error instanceof Error ? error.message : fallback;
  return { ok: false, error: { code: "internal", message, details: { issues: [] } } };
}

// src/rpc.js
function stripSecrets(value) {
  if (!value || typeof value !== "object") return value;
  const next = { ...value };
  delete next.accessToken;
  delete next.token;
  delete next.refresh;
  delete next.refresh_token;
  delete next.key;
  if (next.catalog) {
    next.catalog = {
      source: next.catalog.source,
      error: next.catalog.error,
      models: Array.isArray(next.catalog.models) ? next.catalog.models.map((model) => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        reasoning: model.reasoning,
        source: model.source
      })) : []
    };
  }
  if (next.account) {
    next.account = {
      signedIn: next.account.signedIn === true,
      maskedAccount: next.account.maskedAccount,
      authMode: next.account.authMode,
      expiresAt: next.account.expiresAt,
      source: next.account.source
    };
  }
  return next;
}
function createRpcHandler(session) {
  return async function handle(endpoint, _payload, _signal) {
    try {
      if (endpoint === "status") return publicResult(stripSecrets(await session.status()));
      if (endpoint === "pull") return publicResult(stripSecrets(await session.pull()));
      if (endpoint === "logout") return publicResult(stripSecrets(await session.logout()));
      if (endpoint === "catalog/refresh") {
        const catalog = await session.refreshCatalog();
        return publicResult(stripSecrets({ catalog, account: session.publicAccount() }));
      }
      if (endpoint === "login/cli") return publicResult(stripSecrets(await session.login({ device: false })));
      if (endpoint === "login/device") return publicResult(stripSecrets(await session.login({ device: true })));
      return publicError(new Error(`Unknown Grok subscription RPC: ${endpoint}`));
    } catch (error) {
      return publicError(error);
    }
  };
}

// src/transport.js
function parseEnvelope(body, method) {
  if (!body || typeof body !== "object") return void 0;
  if (body.method !== method) return void 0;
  return {
    rpcId: body.rpcId,
    payload: body.payload
  };
}
function registerSubscriptionTransport(connection, handler) {
  const disposers = [];
  try {
    for (const endpoint of RPC_ENDPOINTS) {
      const method = `grok-subscription/${endpoint}`;
      if (typeof connection?.fetch?.register !== "function") {
        throw new Error("DSH connection.fetch.register is unavailable");
      }
      disposers.push(connection.fetch.register({
        path: `/api/${method}`,
        methods: ["POST"],
        requestBody: "buffered",
        async fetch(request) {
          if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
            return new Response("content type must be application/json", { status: 415 });
          }
          let body;
          try {
            body = await request.json();
          } catch {
            return new Response("invalid JSON", { status: 400 });
          }
          const envelope = parseEnvelope(body, method);
          if (!envelope) return new Response("invalid RPC envelope", { status: 400 });
          let result;
          try {
            request.signal?.throwIfAborted?.();
            result = await handler(endpoint, envelope.payload, request.signal);
          } catch {
            result = { ok: false, error: { code: "internal", message: "Grok subscription request failed", details: { issues: [] } } };
          }
          return Response.json({ type: "server-response", rpcId: envelope.rpcId, result });
        }
      }));
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose?.();
    throw error;
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose?.();
  };
}

// src/adapter.js
async function optionalImport(specifier) {
  try {
    return await import(specifier);
  } catch {
    return void 0;
  }
}
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    if (typeof block === "string") return block;
    if (block?.type === "text") return block.text ?? "";
    if (block?.type === "reasoning") return "";
    if (block?.type === "tool-result") {
      return typeof block.content === "string" ? block.content : textOf(block.content);
    }
    return "";
  }).join("");
}
function responsesInput(options) {
  const input = [];
  const system = typeof options.system === "string" && options.system ? options.system : void 0;
  if (system) input.push({ role: "system", content: system });
  for (const message of options.messages ?? []) {
    const role = message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user";
    const toolCalls = (message.content ?? []).filter((block) => block?.type === "tool-call");
    const toolResults = (message.content ?? []).filter((block) => block?.type === "tool-result");
    if (toolResults.length) {
      for (const block of toolResults) {
        input.push({
          type: "function_call_output",
          call_id: block.toolCallId ?? block.id,
          output: textOf(block.content)
        });
      }
      continue;
    }
    if (role === "assistant" && toolCalls.length) {
      for (const block of toolCalls) {
        input.push({
          type: "function_call",
          call_id: block.id,
          name: block.name,
          arguments: typeof block.arguments === "string" ? block.arguments : JSON.stringify(block.arguments ?? {})
        });
      }
      const text = textOf(message.content);
      if (text) input.push({ role: "assistant", content: text });
      continue;
    }
    input.push({ role, content: textOf(message.content) });
  }
  return input;
}
function mapFinish(reason) {
  if (reason === "toolUse" || reason === "tool_calls") return { kind: "tool-calls" };
  if (reason === "length" || reason === "max_tokens") return { kind: "max-tokens" };
  return { kind: "stop" };
}
async function* streamResponses(options, token) {
  const headers = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    ...buildProxyHeaders(token)
  };
  try {
    const llm = await optionalImport("@deepseek-ai/dsh-llm");
    if (typeof llm?.attributionHeaders === "function") Object.assign(headers, llm.attributionHeaders());
  } catch {
  }
  const body = {
    model: options.model,
    input: responsesInput(options),
    stream: true
  };
  if (typeof options.maxTokens === "number") body.max_output_tokens = options.maxTokens;
  if (typeof options.temperature === "number") body.temperature = options.temperature;
  if (Array.isArray(options.tools) && options.tools.length) {
    body.tools = options.tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }
  if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort };
  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error",
    signal: options.signal
  });
  if (!response.ok) {
    const error = new Error(`Grok Build proxy returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (!response.body) throw new Error("Grok Build proxy returned an empty body");
  const decoder = new TextDecoder();
  let buffer = "";
  let textIndex;
  let reasoningIndex;
  let nextIndex = 0;
  const toolBlocks = /* @__PURE__ */ new Map();
  let usage;
  let finish = { kind: "stop" };
  const flushSse = function* (raw) {
    const lines = raw.split("\n");
    let event = "message";
    const data = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    const payloadText = data.join("\n");
    if (!payloadText || payloadText === "[DONE]") return;
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      return;
    }
    const type = payload.type ?? event;
    if (type === "response.output_text.delta" || type === "response.text.delta") {
      const delta = payload.delta ?? payload.text ?? "";
      if (!delta) return;
      if (textIndex === void 0) {
        textIndex = nextIndex++;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      yield { type: "text-delta", index: textIndex, text: String(delta) };
      return;
    }
    if (type === "response.reasoning_text.delta" || type === "response.reasoning.delta") {
      const delta = payload.delta ?? payload.text ?? "";
      if (!delta) return;
      if (reasoningIndex === void 0) {
        reasoningIndex = nextIndex++;
        yield { type: "block-start", index: reasoningIndex, blockType: "reasoning" };
      }
      yield { type: "reasoning-delta", index: reasoningIndex, text: String(delta) };
      return;
    }
    if (type === "response.function_call_arguments.delta") {
      const id = payload.item_id ?? payload.call_id ?? payload.id;
      if (!id) return;
      let tool = toolBlocks.get(id);
      if (!tool) {
        tool = { index: nextIndex++, id, name: payload.name ?? payload.item?.name, arguments: "" };
        toolBlocks.set(id, tool);
        yield { type: "block-start", index: tool.index, blockType: "tool-call" };
      }
      const delta = payload.delta ?? payload.arguments ?? "";
      tool.arguments += delta;
      yield { type: "tool-call-delta", index: tool.index, id, name: tool.name, argumentsDelta: String(delta) };
      return;
    }
    if (type === "response.completed") {
      const responseUsage = payload.response?.usage ?? payload.usage;
      if (responseUsage) {
        usage = {
          inputTokens: responseUsage.input_tokens ?? responseUsage.prompt_tokens ?? 0,
          outputTokens: responseUsage.output_tokens ?? responseUsage.completion_tokens ?? 0,
          totalTokens: responseUsage.total_tokens
        };
      }
      finish = mapFinish(payload.response?.status === "incomplete" ? "length" : "stop");
      if (toolBlocks.size) finish = { kind: "tool-calls" };
    }
    if (type === "response.failed" || type === "error") {
      const message = payload.error?.message ?? payload.message ?? "Grok Build stream failed";
      finish = { kind: "error", failure: { message, code: "PROVIDER", status: payload.error?.status } };
    }
  };
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let separator;
    while ((separator = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      yield* flushSse(raw);
    }
  }
  if (buffer.trim()) yield* flushSse(buffer);
  if (reasoningIndex !== void 0) {
    yield { type: "block-end", index: reasoningIndex, block: { type: "reasoning", text: "" } };
  }
  if (textIndex !== void 0) {
    yield { type: "block-end", index: textIndex, block: { type: "text", text: "" } };
  }
  for (const tool of toolBlocks.values()) {
    yield {
      type: "block-end",
      index: tool.index,
      block: { type: "tool-call", id: tool.id, name: tool.name ?? "tool", arguments: tool.arguments }
    };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finish };
}
function visiblePiModels(session) {
  if (session.publicAccount()?.signedIn !== true) return [];
  return toPiModels(session.models()).map((model) => model.provider === PROVIDER_ID ? model : { ...model, provider: PROVIDER_ID });
}
function createDuckAdapter(session) {
  const providerInfo = () => ({ id: PROVIDER_ID, name: DISPLAY_NAME });
  const list = () => {
    const signedIn = session.publicAccount()?.signedIn === true;
    return signedIn ? toLlmModels(session.models()) : [];
  };
  return {
    providerInfo,
    providerRetryPolicy() {
      return void 0;
    },
    async listModels(provider) {
      if (provider !== PROVIDER_ID) return [];
      return list();
    },
    async resolveModel(provider, model) {
      const found = list().find((item) => item.id === model);
      return {
        provider,
        id: model,
        name: found?.name ?? model,
        inputModalities: ["text"],
        context: { contextWindow: 5e5 }
      };
    },
    async prepareCall(provider, model, signal) {
      const resolved = await this.resolveModel(provider, model, signal);
      return {
        model: resolved,
        stream: (options) => this.stream(options)
      };
    },
    async *stream(options) {
      if (options.provider !== PROVIDER_ID) {
        yield { type: "finish", reason: { kind: "error", failure: { message: "Unknown provider", code: "NO_ADAPTER" } } };
        return;
      }
      const token = await session.currentToken();
      if (!token) {
        yield { type: "finish", reason: { kind: "error", failure: { message: "Grok subscription is not signed in", code: "MISSING_CREDENTIAL" } } };
        return;
      }
      try {
        yield* streamResponses(options, token);
      } catch (error) {
        const aborted = options.signal?.aborted === true;
        yield {
          type: "finish",
          reason: {
            kind: aborted ? "aborted" : "error",
            failure: {
              message: error instanceof Error ? error.message : "Grok Build request failed",
              code: aborted ? "ABORTED" : "PROVIDER",
              status: error?.status
            }
          }
        };
      }
    }
  };
}
function createStore(session) {
  return {
    async read(providerId) {
      if (providerId !== PROVIDER_ID) return void 0;
      const token = await session.currentToken();
      return token ? { type: "api_key", key: token } : void 0;
    },
    async list() {
      const token = await session.currentToken();
      return token ? [{ providerId: PROVIDER_ID, type: "api_key" }] : [];
    },
    async modify(providerId, update) {
      if (providerId !== PROVIDER_ID) return void 0;
      const current = await this.read(providerId);
      return update(current);
    },
    async delete(providerId) {
      if (providerId === PROVIDER_ID) await session.logout();
    }
  };
}
function buildAuthConfig() {
  return {
    apiKey: {
      name: "Grok Build subscription token",
      async resolve({ credential }) {
        const key = credential?.type === "api_key" ? credential.key : void 0;
        if (typeof key !== "string" || key.length === 0) return void 0;
        return { auth: { apiKey: key, headers: fingerprintHeaders() }, source: "Grok Build subscription" };
      }
    }
  };
}
async function createGrokBuildAdapter(session) {
  const [piAi, dshPi, dshLlm] = await Promise.all([
    optionalImport("@earendil-works/pi-ai"),
    optionalImport("@deepseek-ai/dsh-llm-pi-ai"),
    optionalImport("@deepseek-ai/dsh-llm")
  ]);
  const duck = createDuckAdapter(session);
  const asHostAdapter = (candidate) => {
    if (!dshLlm?.LlmAdapter || candidate instanceof dshLlm.LlmAdapter) return candidate;
    class GrokBuildAdapter extends dshLlm.LlmAdapter {
      providerInfo(provider) {
        return candidate.providerInfo(provider);
      }
      providerRetryPolicy(provider) {
        return candidate.providerRetryPolicy(provider);
      }
      listModels(provider) {
        return candidate.listModels(provider);
      }
      resolveModel(provider, model, signal) {
        return candidate.resolveModel(provider, model, signal);
      }
      prepareCall(provider, model, signal) {
        return candidate.prepareCall(provider, model, signal);
      }
      stream(options) {
        return candidate.stream(options);
      }
    }
    return new GrokBuildAdapter();
  };
  if (!piAi?.createProvider || !dshPi?.PiAiAdapter) {
    return {
      adapter: asHostAdapter(duck),
      kind: "custom-mvp",
      note: "PiAiAdapter or @earendil-works/pi-ai is not available in this host; using a documented custom Responses adapter."
    };
  }
  let responsesApi;
  try {
    const lazy = await import("@earendil-works/pi-ai/api/openai-responses.lazy");
    responsesApi = typeof lazy.openAIResponsesApi === "function" ? lazy.openAIResponsesApi() : void 0;
  } catch {
    responsesApi = void 0;
  }
  if (!responsesApi) {
    return { adapter: asHostAdapter(duck), kind: "custom-mvp", note: "openai-responses API module is unavailable; using the custom adapter." };
  }
  const store = createStore(session);
  const authModels = piAi.createModels({
    credentials: store,
    authContext: {
      env: async () => void 0,
      fileExists: async () => false
    }
  });
  const authProvider = piAi.createProvider({
    id: PROVIDER_ID,
    name: DISPLAY_NAME,
    baseUrl: PROXY_BASE_URL,
    headers: fingerprintHeaders(),
    auth: buildAuthConfig(),
    models: [],
    api: responsesApi
  });
  authModels.setProvider(authProvider);
  const buildLiveProvider = () => {
    const base = piAi.createProvider({
      id: PROVIDER_ID,
      name: DISPLAY_NAME,
      baseUrl: PROXY_BASE_URL,
      headers: fingerprintHeaders(),
      auth: buildAuthConfig(),
      // Snapshot for createProvider internals; PiAiAdapter.listModels uses getModels().
      models: visiblePiModels(session),
      fetchModels: async (context) => {
        if (!context.allowNetwork) return visiblePiModels(session);
        const token = context.credential?.type === "api_key" ? context.credential.key : await session.currentToken();
        if (!token || session.publicAccount()?.signedIn !== true) return [];
        const catalog = await session.refreshCatalog();
        return toPiModels(catalog.models).map((model) => model.provider === PROVIDER_ID ? model : { ...model, provider: PROVIDER_ID });
      },
      api: responsesApi
    });
    return {
      ...base,
      // Critical: listModels reads getModels(), not fetchModels / frozen models[].
      getModels: () => visiblePiModels(session)
    };
  };
  const buildProfile = () => Object.freeze({
    provider: PROVIDER_ID,
    displayName: DISPLAY_NAME,
    piProvider: buildLiveProvider(),
    configuredMaxTokens: /* @__PURE__ */ new Map(),
    modelErrors: /* @__PURE__ */ new Map(),
    streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS,
    maxRequestImageBytes: MAX_REQUEST_IMAGE_BYTES,
    requestImagePixelBudget: REQUEST_IMAGE_PIXEL_BUDGET,
    requestImageMaxBytes: REQUEST_IMAGE_MAX_BYTES,
    cacheRetention: "short",
    transport: "sse"
  });
  const LlmError = dshLlm?.LlmError;
  const adapter = new dshPi.PiAiAdapter({
    // Rebuild provider each call so getModels() sees post-pull session.models().
    profiles: () => /* @__PURE__ */ new Map([[PROVIDER_ID, buildProfile()]]),
    resolveApiKey: async () => {
      const token = await session.currentToken();
      if (!token) {
        if (LlmError) throw new LlmError("Grok subscription is not signed in", "MISSING_CREDENTIAL");
        throw new Error("Grok subscription is not signed in");
      }
      return token;
    },
    auth: Object.freeze({
      credentials: store,
      authContext: Object.freeze({
        env: async () => void 0,
        fileExists: async () => false
      })
    })
  });
  return {
    adapter,
    kind: "pi-ai",
    note: void 0,
    provider: buildLiveProvider(),
    refresh: () => authModels.refresh({ allowNetwork: true, force: true })
  };
}

// src/index.js
var name = CORDIS_ID;
var inject = ["llm", "credentials", "settings", "web"];
function apply(ctx) {
  let active = true;
  if (typeof ctx.effect === "function") {
    ctx.effect(
      () => () => {
        active = false;
      },
      "grok-subscription: startup lifetime"
    );
  }
  const notifyCatalogChange = () => {
    if (!active) return;
    try {
      ctx.emit("llm/adapters-updated");
    } catch (error) {
      ctx.logger?.warn?.("an llm/adapters-updated listener failed");
      ctx.logger?.warn?.(error);
    }
  };
  const session = createSessionService({
    credentials: ctx.credentials,
    logger: ctx.logger,
    onCatalogChange: notifyCatalogChange
  });
  const handler = createRpcHandler(session);
  void boot(ctx, session, notifyCatalogChange);
  ctx.inject(["connection"], (connectionContext) => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    "grok-subscription: host-only account RPC"
  ));
}
async function boot(ctx, session, notifyCatalogChange) {
  await tryRegisterSettings(ctx);
  try {
    await session.pull();
  } catch (error) {
    ctx.logger?.debug?.("Grok subscription startup pull skipped: %s", error instanceof Error ? error.message : "unknown");
  }
  try {
    const created = await createGrokBuildAdapter(session);
    if (created.note) ctx.logger?.warn?.(created.note);
    ctx.llm.registerAdapter([PROVIDER_ID], created.adapter);
    try {
      ctx.llm.registerConfigurableProviders?.([{
        provider: PROVIDER_ID,
        displayName: DISPLAY_NAME,
        settingsNs: SETTINGS_NAMESPACE,
        settingsPath: []
      }]);
    } catch (error) {
      ctx.logger?.debug?.("Grok subscription provider directory skipped: %s", error instanceof Error ? error.message : "unknown");
    }
    notifyCatalogChange?.();
  } catch (error) {
    ctx.logger?.warn?.("Grok subscription adapter failed to start: %s", error instanceof Error ? error.message : "unknown");
  }
}
async function tryRegisterSettings(ctx) {
  if (typeof ctx.settings?.register !== "function") return;
  try {
    const mod = await import("@deepseek-ai/schemastery");
    const z = mod.default ?? mod;
    ctx.settings.register(SETTINGS_NAMESPACE, z.object({}));
  } catch (error) {
    ctx.logger?.debug?.("Grok subscription settings namespace skipped: %s", error instanceof Error ? error.message : "unknown");
  }
}
export {
  DISPLAY_NAME,
  DISPLAY_NAME_ZH,
  PROVIDER_ID,
  apply,
  inject,
  name
};
