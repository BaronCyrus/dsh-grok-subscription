// src/constants.js
var PLUGIN_ID = "dsh-grok-subscription";
var CORDIS_ID = "grok-subscription";
var PROVIDER_ID = "grok-build";
var DISPLAY_NAME = "Grok Build (subscription)";
var DISPLAY_NAME_ZH = "Grok \u8BA2\u9605";
var SETTINGS_NAMESPACE = "grokSubscription";
var CREDENTIAL_REF_NAME = "GROK_BUILD_ACCESS_TOKEN";
var PROXY_BASE_URL = "https://cli-chat-proxy.grok.com/v1";
var MODELS_V2_URL = "https://cli-chat-proxy.grok.com/v1/models-v2";
var BILLING_CREDITS_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
var TOKEN_AUTH_HEADER = "X-XAI-Token-Auth";
var TOKEN_AUTH_VALUE = "xai-grok-cli";
var CLIENT_IDENTIFIER_HEADER = "x-grok-client-identifier";
var CLIENT_VERSION_HEADER = "x-grok-client-version";
var CLIENT_IDENTIFIER = "grok-shell";
var CLIENT_VERSION_FALLBACK = "99.0.0";
var API_KEY_SCOPE = "xai::api_key";
var XAI_OAUTH_ISSUER = "https://auth.x.ai";
var GROK_OIDC_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
var SESSION_AUTH_MODES = Object.freeze(["oidc", "external", "web_login", "grok"]);
var API_KEY_AUTH_MODES = Object.freeze(["api_key"]);
var AUTH_FILE_MAX_BYTES = 1048576;
var CATALOG_TIMEOUT_MS = 15e3;
var USAGE_TIMEOUT_MS = 8e3;
var STORE_TOKEN_TIMEOUT_MS = 5e3;
var TOKEN_EXPIRY_SKEW_MS = 12e4;
var CLI_REFRESH_TIMEOUT_MS = 2e4;
var STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1e3;
var MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
var FALLBACK_MODEL_IDS = Object.freeze(["grok-4.7", "grok-4.6", "grok-4.5"]);
var IMAGE_INPUT_MODEL_IDS = Object.freeze([
  "grok-4.7",
  "grok-4.7-build-fast",
  "grok-4.6"
]);
var IMPORT_TIMEOUT_MS = 2500;
var CREDENTIALS_IO_TIMEOUT_MS = 1500;
var RPC_HANDLER_TIMEOUT_MS = 8e3;
var LOGIN_HANDLER_TIMEOUT_MS = 2e4;

// src/session.js
import { spawn } from "node:child_process";

// src/auth-file.js
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
var XAI_OAUTH_ISSUER2 = "https://auth.x.ai";
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
    refreshToken: asNonEmptyString(object.refresh_token ?? object.refreshToken),
    oidcIssuer: asNonEmptyString(object.oidc_issuer ?? object.oidcIssuer),
    oidcClientId: asNonEmptyString(object.oidc_client_id ?? object.oidcClientId),
    authMode,
    email,
    userId,
    expiresAt,
    maskedAccount: maskAccount(email) ?? maskAccount(userId)
  });
}
function preferredScopeScore(scope, entry) {
  const issuer = entry && typeof entry === "object" ? asNonEmptyString(entry.oidc_issuer ?? entry.oidcIssuer) : void 0;
  if (typeof scope === "string" && scope.startsWith(`${XAI_OAUTH_ISSUER2}::`)) return 3;
  if (issuer === XAI_OAUTH_ISSUER2) return 2;
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
function fileMeta(stat) {
  return {
    isSymbolicLink: typeof stat.isSymbolicLink === "function" ? stat.isSymbolicLink() : Boolean(stat.isSymbolicLink),
    isFile: typeof stat.isFile === "function" ? stat.isFile() : Boolean(stat.isFile),
    mode: stat.mode,
    uid: stat.uid,
    size: stat.size
  };
}
function writeOauthSession(path, fields, options = {}) {
  if (!asNonEmptyString(fields?.accessToken) || !asNonEmptyString(fields?.issuer) || !asNonEmptyString(fields?.clientId)) {
    throw new Error("Refusing to store an OAuth session without an access token");
  }
  const lstat = options.lstat ?? ((target) => lstatSync(target, { throwIfNoEntry: false }));
  const existing = lstat(path);
  let document = {};
  if (existing) {
    const meta = fileMeta(existing);
    if (meta.isSymbolicLink) throw new Error("Refusing to write a symbolic-link Grok auth.json");
    if (!meta.isFile) throw new Error("Grok auth.json is not a regular file");
    const platform = options.platform ?? process.platform;
    const currentUid = options.uid ?? process.getuid?.();
    if (platform !== "win32" && typeof currentUid === "number" && typeof meta.uid === "number" && meta.uid !== currentUid) {
      throw new Error("Grok auth.json is not owned by the current user");
    }
    if (typeof meta.size === "number" && meta.size > AUTH_FILE_MAX_BYTES) {
      throw new Error("Grok auth.json is larger than the allowed size");
    }
    document = readSecureJsonFile(path, options);
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      throw new Error("Grok auth document is not an object");
    }
  }
  const scope = `${fields.issuer}::${fields.clientId}`;
  const previous = document[scope] && typeof document[scope] === "object" && !Array.isArray(document[scope]) ? document[scope] : {};
  const next = { ...previous, key: fields.accessToken, auth_mode: "oidc", oidc_issuer: fields.issuer, oidc_client_id: fields.clientId };
  if (asNonEmptyString(fields.expiresAt)) next.expires_at = fields.expiresAt;
  if (asNonEmptyString(fields.refreshToken)) next.refresh_token = fields.refreshToken;
  if (asNonEmptyString(fields.email)) next.email = fields.email;
  if (asNonEmptyString(fields.userId)) next.user_id = fields.userId;
  document[scope] = next;
  writeSecureJsonFile(path, document, options);
  return parseAuthDocument(document);
}
function writeSecureJsonFile(path, document, options = {}) {
  const mkdir = options.mkdir ?? ((dir) => mkdirSync(dir, { recursive: true, mode: 448 }));
  const open = options.open ?? ((target) => openSync(target, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 384));
  const write = options.write ?? ((fd2, payload2) => writeSync(fd2, payload2));
  const close = options.close ?? closeSync;
  const rename = options.rename ?? renameSync;
  const unlink = options.unlink ?? unlinkSync;
  const chmod = options.chmod ?? chmodSync;
  mkdir(dirname(path));
  const tmp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  const payload = `${JSON.stringify(document, null, 2)}
`;
  const fd = open(tmp);
  try {
    write(fd, payload);
  } catch (error) {
    try {
      close(fd);
    } catch {
    }
    try {
      unlink(tmp);
    } catch {
    }
    throw error;
  }
  close(fd);
  try {
    rename(tmp, path);
  } catch (error) {
    try {
      unlink(tmp);
    } catch {
    }
    throw error;
  }
  try {
    chmod(path, 384);
  } catch {
  }
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
function releaseAtLeast(version, minimum) {
  const parse = (value) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(typeof value === "string" ? value.trim() : "");
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : void 0;
  };
  const left = parse(version);
  const right = parse(minimum);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}
function readClientVersion(env = process.env, options = {}) {
  if (typeof env.DSH_GROK_CLIENT_VERSION === "string" && env.DSH_GROK_CLIENT_VERSION.trim()) {
    return env.DSH_GROK_CLIENT_VERSION.trim();
  }
  const fallback = options.fallback ?? CLIENT_VERSION_FALLBACK;
  const path = options.path ?? versionJsonPath(env);
  const exists = options.exists ?? existsSync;
  const read = options.read ?? ((target) => readFileSync2(target, "utf8"));
  if (!exists(path)) return fallback;
  try {
    const parsed = parseClientVersion(JSON.parse(read(path)));
    return parsed && releaseAtLeast(parsed, fallback) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function fingerprintHeaders(options = {}) {
  const identifier = options.identifier ?? CLIENT_IDENTIFIER;
  const version = options.version ?? readClientVersion(options.env, options);
  return Object.freeze({
    [TOKEN_AUTH_HEADER]: TOKEN_AUTH_VALUE,
    [CLIENT_IDENTIFIER_HEADER]: identifier,
    [CLIENT_VERSION_HEADER]: version,
    "User-Agent": `${identifier}/${version}`
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

// src/http-json.js
import { brotliDecompressSync, gunzipSync, inflateSync, zstdDecompressSync } from "node:zlib";
var MAGIC_GZIP = [31, 139];
var MAGIC_ZSTD = [40, 181, 47, 253];
var DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
function startsWith(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}
function maxOutputOf(options) {
  return typeof options.maxOutputBytes === "number" && options.maxOutputBytes > 0 ? options.maxOutputBytes : DEFAULT_MAX_OUTPUT_BYTES;
}
function decodeCompressedBody(buffer, encoding = "", options = {}) {
  const declared = String(encoding ?? "").toLowerCase();
  const kind = declared.includes("gzip") || startsWith(buffer, MAGIC_GZIP) ? "gzip" : declared.includes("zstd") || startsWith(buffer, MAGIC_ZSTD) ? "zstd" : declared.includes("deflate") ? "deflate" : declared.includes("br") ? "br" : void 0;
  if (!kind) return buffer;
  const limits = { maxOutputLength: maxOutputOf(options) };
  try {
    if (kind === "gzip") return gunzipSync(buffer, limits);
    if (kind === "zstd") return zstdDecompressSync(buffer, limits);
    if (kind === "deflate") return inflateSync(buffer, limits);
    return brotliDecompressSync(buffer, limits);
  } catch {
    return buffer;
  }
}
async function readResponseText(response, options = {}) {
  if (typeof response.arrayBuffer !== "function") {
    if (typeof response.text === "function") return response.text();
    throw new TypeError("response exposes neither arrayBuffer() nor text()");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const encoding = typeof response.headers?.get === "function" ? response.headers.get("content-encoding") ?? "" : "";
  return decodeCompressedBody(buffer, encoding, options).toString("utf8");
}
async function readResponseJson(response, options = {}) {
  if (typeof response.arrayBuffer !== "function" && typeof response.json === "function") {
    return response.json();
  }
  return JSON.parse(await readResponseText(response, options));
}

// src/catalog.js
var REASONING_LEVELS = Object.freeze(["low", "medium", "high", "xhigh"]);
var DOCUMENTED_CONTEXT_WINDOWS = Object.freeze({
  "grok-4.7": 5e5,
  "grok-4.7-build-fast": 5e5,
  "grok-4.6": 5e5,
  "grok-4.5": 5e5,
  "grok-4.3": 1e6,
  "grok-4.20-0309-reasoning": 1e6,
  "grok-4.20-0309-non-reasoning": 1e6,
  "grok-4.20-multi-agent-0309": 1e6,
  "grok-build-0.1": 256e3
});
var FALLBACK_CONTEXT_WINDOW = 5e5;
function documentedContextWindow(id) {
  return Object.prototype.hasOwnProperty.call(DOCUMENTED_CONTEXT_WINDOWS, id) ? DOCUMENTED_CONTEXT_WINDOWS[id] : void 0;
}
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
    const contextWindow = documentedContextWindow(id) ?? contextWindowOf(object) ?? FALLBACK_CONTEXT_WINDOW;
    models.push(Object.freeze({
      id,
      name: displayNameOf(id, object),
      contextWindow,
      maxTokens: contextWindow,
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
    contextWindow: documentedContextWindow(id) ?? FALLBACK_CONTEXT_WINDOW,
    maxTokens: documentedContextWindow(id) ?? FALLBACK_CONTEXT_WINDOW,
    reasoning: true,
    reasoningEfforts: id === "grok-4.5" ? ["low", "medium", "high"] : ["low", "medium", "high", "xhigh"],
    defaultEffort: "high",
    source: "fallback"
  }));
}
function mergeCatalog(live) {
  if (!Array.isArray(live) || live.length === 0) {
    return fallbackModels().map((model) => ({ ...model }));
  }
  return live.map((model) => ({ ...model, source: "live" }));
}
function supportsImageInput(id) {
  return typeof id === "string" && IMAGE_INPUT_MODEL_IDS.includes(id);
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
      input: supportsImageInput(model.id) ? ["text", "image"] : ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.contextWindow ?? FALLBACK_CONTEXT_WINDOW,
      maxTokens: model.maxTokens ?? FALLBACK_CONTEXT_WINDOW,
      compat: { supportsLongCacheRetention: false, supportsDeveloperRole: false }
    };
  });
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
  const body = await readResponseJson(response);
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

// src/usage.js
var USAGE_SOURCE = "billing-credits-undocumented";
var SHANGHAI_TZ = "Asia/Shanghai";
function unavailable(reason, extra = {}) {
  return Object.freeze({
    status: "unavailable",
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : "Usage unavailable",
    ...extra,
    experimental: true,
    source: USAGE_SOURCE
  });
}
function asFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  if (value && typeof value === "object" && !Array.isArray(value) && "val" in value) {
    return asFiniteNumber(value.val);
  }
  return void 0;
}
function asFinitePercent(value) {
  return asFiniteNumber(value);
}
function asIsoString(value) {
  if (typeof value !== "string" || !value.trim()) return void 0;
  const trimmed = value.trim();
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return void 0;
  return new Date(ms).toISOString();
}
function formatShanghai(iso) {
  if (!iso) return void 0;
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: SHANGHAI_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date(iso));
  } catch {
    return void 0;
  }
}
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function topLevelKeys(body) {
  return Object.keys(body).filter((key) => typeof key === "string").slice(0, 24);
}
function missingPercentReason(body) {
  const keys = topLevelKeys(body);
  if (keys.length === 0) {
    return "Missing creditUsagePercent (empty object)";
  }
  return `Missing creditUsagePercent (keys: ${keys.join(",")})`;
}
function isUnifiedBillingBody(body) {
  const config = isPlainObject(body.config) ? body.config : void 0;
  return config?.isUnifiedBillingUser === true || isPlainObject(config?.onDemandCap) || isPlainObject(config?.prepaidBalance);
}
function unifiedBillingReason(body) {
  const config = isPlainObject(body.config) ? body.config : {};
  const balance = asFiniteNumber(config.prepaidBalance);
  const cap = asFiniteNumber(config.onDemandCap);
  return `No credit percentage in this billing response (unified billing: prepaidBalance ${balance ?? "n/a"}, onDemandCap ${cap ?? "n/a"})`;
}
function periodFields(body) {
  const { start, end } = resolvePeriodBounds(body);
  return {
    ...start ? { periodStart: start, periodStartLocal: formatShanghai(start) } : {},
    ...end ? { periodEnd: end, periodEndLocal: formatShanghai(end) } : {}
  };
}
function firstDefined(...values) {
  for (const value of values) {
    if (value !== void 0 && value !== null) return value;
  }
  return void 0;
}
function readPercentCandidate(node) {
  if (!isPlainObject(node)) return void 0;
  return asFinitePercent(firstDefined(
    node.creditUsagePercent,
    node.usedPercent,
    node.usagePercent,
    node.percentUsed,
    node.used_percent,
    node.usage_percent
  ));
}
function resolveUsedPercent(body) {
  const config = isPlainObject(body.config) ? body.config : void 0;
  const usage = isPlainObject(body.usage) ? body.usage : void 0;
  const credits = isPlainObject(body.credits) ? body.credits : void 0;
  const direct = firstDefined(
    readPercentCandidate(body),
    readPercentCandidate(config),
    readPercentCandidate(usage),
    readPercentCandidate(credits),
    asFinitePercent(credits?.usedPercent)
  );
  if (direct !== void 0) return direct;
  const used = firstDefined(
    asFiniteNumber(body.used),
    asFiniteNumber(body.includedUsed),
    asFiniteNumber(body.totalUsed),
    asFiniteNumber(config?.includedUsed),
    asFiniteNumber(config?.totalUsed),
    asFiniteNumber(usage?.used),
    asFiniteNumber(credits?.used)
  );
  const total = firstDefined(
    asFiniteNumber(body.total),
    asFiniteNumber(body.monthlyLimit),
    asFiniteNumber(config?.monthlyLimit),
    asFiniteNumber(usage?.total),
    asFiniteNumber(credits?.total),
    asFiniteNumber(credits?.limit)
  );
  if (used !== void 0 && total !== void 0 && total > 0) {
    return used / total * 100;
  }
  return void 0;
}
function nowMillis(options) {
  if (options?.now instanceof Date) {
    const ms = options.now.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }
  if (typeof options?.now === "number" && Number.isFinite(options.now)) return options.now;
  return Date.now();
}
function currentPeriodOf(body) {
  const config = isPlainObject(body.config) ? body.config : void 0;
  if (isPlainObject(config?.currentPeriod)) return config.currentPeriod;
  if (isPlainObject(body.currentPeriod)) return body.currentPeriod;
  return void 0;
}
function productHasPercent(body) {
  const raw = resolveProductUsage(body);
  if (!Array.isArray(raw)) return false;
  return raw.some((item) => {
    if (!item || typeof item !== "object") return false;
    return asFinitePercent(firstDefined(
      item.creditUsagePercent,
      item.usedPercent,
      item.usagePercent,
      item.percentUsed,
      item.used_percent
    )) !== void 0;
  });
}
function omittedZeroReading(body, nowMs) {
  const period = currentPeriodOf(body);
  if (!period) return void 0;
  const type = typeof period.type === "string" ? period.type.trim() : "";
  if (!/weekly$/i.test(type) && !/monthly$/i.test(type)) return void 0;
  const start = asIsoString(period.start);
  const end = asIsoString(period.end);
  if (!start || !end) return void 0;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!(endMs > startMs) || nowMs < startMs || nowMs >= endMs) return void 0;
  if (productHasPercent(body)) return void 0;
  return { start, end };
}
function resolvePeriodBounds(body) {
  const config = isPlainObject(body.config) ? body.config : void 0;
  const period = firstDefined(
    isPlainObject(config?.currentPeriod) ? config.currentPeriod : void 0,
    isPlainObject(body.currentPeriod) ? body.currentPeriod : void 0,
    isPlainObject(body.period) ? body.period : void 0
  );
  const start = firstDefined(
    period ? asIsoString(period.start) : void 0,
    asIsoString(config?.billingPeriodStart),
    asIsoString(body.billingPeriodStart),
    asIsoString(body.periodStart),
    asIsoString(body.resetStart)
  );
  const end = firstDefined(
    period ? asIsoString(period.end) : void 0,
    asIsoString(config?.billingPeriodEnd),
    asIsoString(body.billingPeriodEnd),
    asIsoString(body.periodEnd),
    asIsoString(body.resetAt),
    asIsoString(body.reset_at)
  );
  return { start, end };
}
function resolveProductUsage(body) {
  const config = isPlainObject(body.config) ? body.config : void 0;
  return firstDefined(
    Array.isArray(body.productUsage) ? body.productUsage : void 0,
    Array.isArray(config?.productUsage) ? config.productUsage : void 0,
    Array.isArray(body.products) ? body.products : void 0
  );
}
function sanitizeProductUsage(raw) {
  if (!Array.isArray(raw)) return void 0;
  const rows = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name2 = typeof item.name === "string" && item.name.trim() ? item.name.trim() : typeof item.product === "string" && item.product.trim() ? item.product.trim() : typeof item.id === "string" && item.id.trim() ? item.id.trim() : void 0;
    const usedPercent = asFinitePercent(firstDefined(
      item.creditUsagePercent,
      item.usedPercent,
      item.usagePercent,
      item.percentUsed,
      item.used_percent
    ));
    if (!name2 && usedPercent === void 0) continue;
    rows.push(Object.freeze({
      ...name2 ? { name: name2 } : {},
      ...usedPercent !== void 0 ? { usedPercent } : {}
    }));
  }
  return rows.length ? Object.freeze(rows) : void 0;
}
function parseBillingCredits(body, options = {}) {
  if (body === null || body === void 0) {
    return unavailable("Empty billing response");
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    return unavailable("Unexpected billing response shape");
  }
  const explicitPercent = resolveUsedPercent(body);
  const omittedZero = explicitPercent === void 0 ? omittedZeroReading(body, nowMillis(options)) : void 0;
  const usedPercent = explicitPercent ?? (omittedZero ? 0 : void 0);
  if (usedPercent === void 0) {
    const unified = isUnifiedBillingBody(body);
    return unavailable(
      unified ? unifiedBillingReason(body) : missingPercentReason(body),
      {
        code: unified ? "unified-billing" : "missing-percent",
        ...periodFields(body)
      }
    );
  }
  const { start: periodStart, end: periodEnd } = resolvePeriodBounds(body);
  const productUsage = sanitizeProductUsage(resolveProductUsage(body));
  const remainingPercent = Math.max(0, 100 - usedPercent);
  return Object.freeze({
    status: "ok",
    experimental: true,
    source: USAGE_SOURCE,
    usedPercent,
    remainingPercent,
    ...omittedZero ? { percentSource: "omitted-zero" } : {},
    ...periodStart ? { periodStart, periodStartLocal: formatShanghai(periodStart) } : {},
    ...periodEnd ? { periodEnd, periodEndLocal: formatShanghai(periodEnd) } : {},
    ...productUsage ? { productUsage } : {}
  });
}
function parseBillingCreditsJson(text, options = {}) {
  if (typeof text !== "string") return unavailable("Non-text billing response");
  if (!text.trim()) return unavailable("Empty billing response");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return unavailable("Invalid JSON from billing API");
  }
  return parseBillingCredits(body, options);
}
async function fetchBillingUsageOnce(accessToken, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return unavailable("Fetch unavailable");
  }
  let response;
  try {
    const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? USAGE_TIMEOUT_MS);
    response = await fetchImpl(BILLING_CREDITS_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...buildProxyHeaders(accessToken, options)
      },
      redirect: "error",
      signal
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    if (/abort|timeout/i.test(message)) return unavailable("Billing request timed out");
    return unavailable("Billing network error");
  }
  if (response.status === 401 || response.status === 403) {
    return unavailable(`Billing unauthorized (HTTP ${response.status})`);
  }
  if (!response.ok) {
    return unavailable(`Billing HTTP ${response.status}`);
  }
  const rawContentType = typeof response.headers?.get === "function" ? response.headers.get("content-type") ?? "" : "";
  const contentType = String(rawContentType).split(";")[0].trim();
  const contentTypeLower = contentType.toLowerCase();
  const looksJson = !contentTypeLower || contentTypeLower.includes("json") || contentTypeLower === "text/plain";
  let text;
  try {
    text = await readResponseText(response);
  } catch {
    return unavailable("Could not read billing body");
  }
  if (!looksJson) {
    const parsedAnyway = parseBillingCreditsJson(text);
    if (parsedAnyway.status === "ok") {
      return Object.freeze({
        ...parsedAnyway,
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return unavailable(`Non-JSON billing Content-Type: ${contentType || "unknown"}`);
  }
  const parsed = parseBillingCreditsJson(text);
  if (parsed.status === "ok") {
    return Object.freeze({
      ...parsed,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return parsed;
}
async function fetchBillingUsage(accessToken, options = {}) {
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return unavailable("Not signed in");
  }
  const timeoutMs = options.timeoutMs ?? USAGE_TIMEOUT_MS;
  let timer;
  try {
    const result = await Promise.race([
      fetchBillingUsageOnce(accessToken, options),
      new Promise((resolve) => {
        timer = setTimeout(
          () => resolve(unavailable("Billing request timed out")),
          timeoutMs
        );
      })
    ]);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    if (/abort|timeout/i.test(message)) return unavailable("Billing request timed out");
    return unavailable("Billing network error");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// src/adapter.js
import { existsSync as existsSync2, readFileSync as readFileSync3 } from "node:fs";
import { createRequire } from "node:module";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname2, join as join2 } from "node:path";
import { pathToFileURL } from "node:url";
function withImportTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
function hostModuleRoots(env = process.env, argv1 = process.argv[1]) {
  const roots = [];
  const push = (dir) => {
    if (typeof dir === "string" && dir && !roots.includes(dir)) roots.push(dir);
  };
  const override = env.DSH_GROK_PEER_ROOT;
  if (typeof override === "string" && override.trim()) push(override.trim());
  if (typeof argv1 === "string" && argv1) {
    let dir = dirname2(argv1);
    for (let depth = 0; depth < 6 && dir && dir !== dirname2(dir); depth++) {
      push(join2(dir, "node_modules"));
      dir = dirname2(dir);
    }
  }
  const prefix = env.NPM_CONFIG_PREFIX;
  if (typeof prefix === "string" && prefix.trim()) push(join2(prefix.trim(), "lib", "node_modules"));
  if (typeof process.execPath === "string" && process.execPath) {
    push(join2(dirname2(process.execPath), "..", "lib", "node_modules"));
  }
  push(join2("/opt/homebrew", "lib", "node_modules"));
  push(join2("/usr/local", "lib", "node_modules"));
  for (const segment of ["Library/pnpm", ".local/share/pnpm", ".pnpm-global"]) {
    push(join2(homedir2(), segment, "node_modules"));
  }
  if (typeof env.DSH_PORTABLE_HOME === "string" && env.DSH_PORTABLE_HOME.trim()) {
    push(join2(env.DSH_PORTABLE_HOME.trim(), "node_modules"));
  }
  push(join2(homedir2(), ".local", "lib", "node_modules"));
  const dshHome = typeof env.DSH_HOME === "string" && env.DSH_HOME.trim() ? env.DSH_HOME.trim() : join2(homedir2(), ".dsh");
  push(join2(dshHome, "profiles", "node_modules"));
  return roots;
}
function splitSpecifier(specifier) {
  const parts = specifier.split("/");
  const take = specifier.startsWith("@") ? 2 : 1;
  return {
    name: parts.slice(0, take).join("/"),
    subpath: parts.length > take ? `./${parts.slice(take).join("/")}` : "."
  };
}
function pickExportTarget(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return void 0;
  for (const condition of ["import", "module", "default", "node"]) {
    if (condition in value) {
      const picked = pickExportTarget(value[condition]);
      if (picked) return picked;
    }
  }
  return void 0;
}
function resolveExportsTarget(exportsField, subpath) {
  if (typeof exportsField === "string") return subpath === "." ? exportsField : void 0;
  if (!exportsField || typeof exportsField !== "object") return void 0;
  const keys = Object.keys(exportsField);
  const isSubpathMap = keys.some((key) => key === "." || key.startsWith("./"));
  if (!isSubpathMap) return subpath === "." ? pickExportTarget(exportsField) : void 0;
  if (subpath in exportsField) return pickExportTarget(exportsField[subpath]);
  for (const key of keys) {
    const star = key.indexOf("*");
    if (star === -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue;
    const matched = subpath.slice(prefix.length, subpath.length - suffix.length);
    const target = pickExportTarget(exportsField[key]);
    if (target) return target.replace("*", matched);
  }
  return void 0;
}
function resolveHostSpecifierManually(root, specifier) {
  const { name: name2, subpath } = splitSpecifier(specifier);
  const candidates = [
    join2(root, name2),
    join2(root, "node_modules", name2),
    join2(root, "@deepseek-ai", "dsh", "node_modules", name2),
    join2(root, "node_modules", "@deepseek-ai", "dsh", "node_modules", name2)
  ];
  for (const pkgDir of candidates) {
    const manifest = join2(pkgDir, "package.json");
    if (!existsSync2(manifest)) continue;
    let pkg;
    try {
      pkg = JSON.parse(readFileSync3(manifest, "utf8"));
    } catch {
      continue;
    }
    const target = pkg.exports !== void 0 ? resolveExportsTarget(pkg.exports, subpath) : subpath === "." ? pkg.module ?? pkg.main ?? "index.js" : void 0;
    if (typeof target !== "string" || !target) continue;
    const file = join2(pkgDir, target);
    if (existsSync2(file)) return file;
  }
  return void 0;
}
function resolveHostSpecifier(specifier, roots = hostModuleRoots()) {
  for (const root of roots) {
    try {
      const resolved = createRequire(join2(root, "noop.js")).resolve(specifier);
      if (typeof resolved === "string" && resolved) return resolved;
    } catch {
    }
    const manual = resolveHostSpecifierManually(root, specifier);
    if (manual) return manual;
  }
  return void 0;
}
async function optionalImport(specifier, options = {}) {
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : IMPORT_TIMEOUT_MS;
  const injected = typeof options.importFn === "function" ? options.importFn : void 0;
  const importFn = injected ?? ((id) => import(id));
  const candidates = [specifier];
  if (!injected && !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("file:")) {
    const resolved = resolveHostSpecifier(specifier, options.hostRoots ?? hostModuleRoots());
    if (resolved) candidates.push(pathToFileURL(resolved).href);
  }
  for (const candidate of candidates) {
    try {
      return await withImportTimeout(
        Promise.resolve(importFn(candidate)),
        timeoutMs,
        `Import timed out after ${timeoutMs}ms: ${specifier}`
      );
    } catch {
    }
  }
  return void 0;
}
var PROMPT_CACHE_KEY_MAX_LENGTH = 64;
function promptCacheKey(options) {
  const sessionId = typeof options?.sessionId === "string" ? options.sessionId.trim() : "";
  if (!sessionId) return void 0;
  const suffix = options.purpose === "compaction" || options.purpose === "session-title" ? `:${options.purpose}` : "";
  const key = `grok${suffix}:${sessionId}`;
  return key.length <= PROMPT_CACHE_KEY_MAX_LENGTH ? key : key.slice(0, PROMPT_CACHE_KEY_MAX_LENGTH);
}
function visiblePiModels(session) {
  if (session.publicAccount()?.signedIn !== true) return [];
  return toPiModels(session.models()).map((model) => model.provider === PROVIDER_ID ? model : { ...model, provider: PROVIDER_ID });
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
function withGrokRequestSemantics(api) {
  const inject2 = (options) => {
    const cacheKey = options?.cacheRetention === "none" ? void 0 : promptCacheKey(options);
    return {
      ...options,
      samplingParams: {
        ...options?.samplingParams,
        include: ["reasoning.encrypted_content"],
        ...cacheKey === void 0 ? {} : { prompt_cache_key: cacheKey }
      }
    };
  };
  return {
    stream: (model, context, options) => api.stream(model, context, inject2(options)),
    streamSimple: (model, context, options) => api.streamSimple(model, context, inject2(options))
  };
}
async function createGrokBuildAdapter(session, options = {}) {
  const importOpts = options.importOptions ?? {};
  const [piAi, dshPi, dshLlm] = await Promise.all([
    optionalImport("@earendil-works/pi-ai", importOpts),
    optionalImport("@deepseek-ai/dsh-llm-pi-ai", importOpts),
    optionalImport("@deepseek-ai/dsh-llm", importOpts)
  ]);
  if (!piAi?.createProvider || !dshPi?.PiAiAdapter) {
    return {
      adapter: void 0,
      kind: "unavailable",
      note: "the host pi-ai adapter is unavailable: @earendil-works/pi-ai and @deepseek-ai/dsh-llm-pi-ai must be resolvable from the DSH install"
    };
  }
  let responsesApi;
  try {
    const lazy = await optionalImport("@earendil-works/pi-ai/api/openai-responses.lazy", importOpts);
    responsesApi = typeof lazy?.openAIResponsesApi === "function" ? lazy.openAIResponsesApi() : void 0;
  } catch {
    responsesApi = void 0;
  }
  if (!responsesApi) {
    return {
      adapter: void 0,
      kind: "unavailable",
      note: "the pi-ai openai-responses API module is unavailable in this host"
    };
  }
  responsesApi = withGrokRequestSemantics(responsesApi);
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
    api: { "openai-responses": responsesApi }
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
      api: { "openai-responses": responsesApi }
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
    transport: "sse",
    reasoning: "high"
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
    }),
    // The host's durable attachment store. Without it PiAiAdapter rejects any
    // request carrying an image ("requires the durable attachment service"),
    // and with it images are normalized to the configured budget for us.
    resolveAttachments: typeof options.resolveAttachments === "function" ? () => options.resolveAttachments() : void 0
  });
  return {
    adapter,
    kind: "pi-ai",
    note: void 0,
    provider: buildLiveProvider(),
    refresh: () => authModels.refresh({ allowNetwork: true, force: true })
  };
}

// src/oauth.js
var OAUTH_SCOPES = "openid profile email offline_access api:access grok-cli:access";
var OAUTH_BODY_LIMIT = 64 * 1024;
var OAUTH_ERROR_LIMIT = 180;
function collapse(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, OAUTH_ERROR_LIMIT);
}
function oauthError(body, status) {
  const code = collapse(body?.error) || "request_failed";
  const description = collapse(body?.error_description);
  if (description && description !== code) return `${code}: ${description} (HTTP ${status})`;
  return `${code} (HTTP ${status})`;
}
async function readOauthBody(response) {
  const status = typeof response.status === "number" ? response.status : 0;
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > OAUTH_BODY_LIMIT) {
    throw new Error(`OAuth response exceeded ${OAUTH_BODY_LIMIT} bytes (HTTP ${status})`);
  }
  let text;
  try {
    text = await readResponseText(response);
  } catch (error) {
    throw new Error(`OAuth response could not be read (HTTP ${status})`, { cause: error });
  }
  if (typeof text !== "string" || text.length > OAUTH_BODY_LIMIT) {
    throw new Error(`OAuth response exceeded ${OAUTH_BODY_LIMIT} bytes (HTTP ${status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`OAuth endpoint returned HTTP ${status} with a non-JSON body`);
  }
}
function timeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  return void 0;
}
async function postForm(url, params, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params).toString(),
    signal: timeoutSignal(CLI_REFRESH_TIMEOUT_MS)
  });
  const body = await readOauthBody(response);
  return { status: typeof response.status === "number" ? response.status : 0, body };
}
function isXaiHttpsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && (host === "x.ai" || host.endsWith(".x.ai"));
  } catch {
    return false;
  }
}
function endpointOnIssuer(value, issuer, field) {
  let url;
  let issuerUrl;
  try {
    url = new URL(value);
    issuerUrl = new URL(issuer);
  } catch {
    throw new Error(`OIDC discovery returned an invalid ${field}`);
  }
  if (url.protocol !== "https:" || issuerUrl.protocol !== "https:") {
    throw new Error(`OIDC discovery returned a non-HTTPS ${field}`);
  }
  if (url.username || url.password) throw new Error(`OIDC discovery returned credentials in ${field}`);
  if (url.origin !== issuerUrl.origin) throw new Error(`OIDC discovery ${field} does not match the issuer`);
  return url.toString();
}
function fallbackOauthEndpoints(issuer = XAI_OAUTH_ISSUER) {
  const base = String(issuer).replace(/\/+$/u, "");
  return {
    deviceAuthorizationEndpoint: `${base}/oauth2/device/code`,
    tokenEndpoint: `${base}/oauth2/token`
  };
}
async function discoverOauthEndpoints(issuer = XAI_OAUTH_ISSUER, options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const base = String(issuer).replace(/\/+$/u, "");
  try {
    const response = await fetchImpl(`${base}/.well-known/openid-configuration`, {
      headers: { accept: "application/json" },
      signal: timeoutSignal(CLI_REFRESH_TIMEOUT_MS)
    });
    const body = await readOauthBody(response);
    const status = typeof response.status === "number" ? response.status : 0;
    if (status < 200 || status >= 300) throw new Error(`OIDC discovery failed (HTTP ${status})`);
    const discovered = typeof body?.issuer === "string" ? body.issuer.replace(/\/+$/u, "") : "";
    if (discovered !== base) throw new Error("OIDC discovery issuer does not match the requested issuer");
    return {
      deviceAuthorizationEndpoint: endpointOnIssuer(body.device_authorization_endpoint, base, "device_authorization_endpoint"),
      tokenEndpoint: endpointOnIssuer(body.token_endpoint, base, "token_endpoint")
    };
  } catch {
    return fallbackOauthEndpoints(base);
  }
}
function clockMs(now) {
  if (typeof now === "function") return now();
  if (typeof now === "number" && Number.isFinite(now)) return now;
  return Date.now();
}
function expiresAtFrom(body, accessToken, nowMs) {
  if (typeof body?.expires_in === "number" && Number.isFinite(body.expires_in) && body.expires_in > 0) {
    return new Date(nowMs + body.expires_in * 1e3).toISOString();
  }
  const exp = jwtExpiryMs(accessToken);
  return typeof exp === "number" ? new Date(exp).toISOString() : void 0;
}
function jwtExpiryMs(token) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length < 2) return void 0;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload?.exp === "number" && Number.isFinite(payload.exp)) return payload.exp * 1e3;
  } catch {
    return void 0;
  }
  return void 0;
}
async function requestDeviceAuthorization(options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const clientId = options.clientId ?? GROK_OIDC_CLIENT_ID;
  const scopes = options.scopes ?? OAUTH_SCOPES;
  const endpoint = options.endpoint;
  if (!isXaiHttpsUrl(endpoint)) throw new Error("Refusing to request a device code from a non-x.ai endpoint");
  const { status, body } = await postForm(endpoint, {
    client_id: clientId,
    scope: scopes
  }, fetchImpl);
  if (body?.error || status < 200 || status >= 300) {
    throw new Error(`Could not start device sign-in: ${oauthError(body, status)}`);
  }
  const deviceCode = typeof body?.device_code === "string" ? body.device_code : "";
  const userCode = typeof body?.user_code === "string" ? body.user_code : "";
  const verificationUri = typeof body?.verification_uri === "string" ? body.verification_uri : void 0;
  const verificationUriComplete = typeof body?.verification_uri_complete === "string" ? body.verification_uri_complete : void 0;
  if (!deviceCode || !userCode) throw new Error("Device sign-in returned no user code");
  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    expiresIn: typeof body?.expires_in === "number" ? body.expires_in : void 0,
    interval: typeof body?.interval === "number" ? body.interval : void 0
  };
}
async function exchangeDeviceCode(options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const clientId = options.clientId ?? GROK_OIDC_CLIENT_ID;
  const endpoint = options.endpoint;
  if (!isXaiHttpsUrl(endpoint)) return { kind: "stop", error: "refusing a non-x.ai token endpoint" };
  const { status, body } = await postForm(endpoint, {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: clientId,
    device_code: options.deviceCode
  }, fetchImpl);
  return classifyTokenResponse(body, status, clockMs(options.now));
}
async function refreshOauthToken(options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const endpoint = options.endpoint;
  if (!isXaiHttpsUrl(endpoint)) throw new Error("Refusing to refresh a token at a non-x.ai endpoint");
  const { status, body } = await postForm(endpoint, {
    grant_type: "refresh_token",
    client_id: options.clientId ?? GROK_OIDC_CLIENT_ID,
    refresh_token: options.refreshToken
  }, fetchImpl);
  const result = classifyTokenResponse(body, status, clockMs(options.now));
  if (result.kind !== "ok") throw new Error(`Could not refresh the session: ${result.error ?? "unknown"}`);
  return result;
}
function classifyTokenResponse(body, status, nowMs) {
  const error = typeof body?.error === "string" ? body.error : "";
  if (error === "authorization_pending") return { kind: "pending" };
  if (error === "slow_down") return { kind: "slow_down" };
  if (error) return { kind: "stop", error: oauthError(body, status) };
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  if (!accessToken || status < 200 || status >= 300) {
    return { kind: "stop", error: oauthError(body, status) };
  }
  const refreshToken = typeof body?.refresh_token === "string" && body.refresh_token ? body.refresh_token : void 0;
  return {
    kind: "ok",
    accessToken,
    refreshToken,
    expiresIn: typeof body?.expires_in === "number" ? body.expires_in : void 0,
    expiresAt: expiresAtFrom(body, accessToken, nowMs),
    issuer: XAI_OAUTH_ISSUER,
    clientId: GROK_OIDC_CLIENT_ID
  };
}

// src/session.js
function openExternal(url, options = {}) {
  const spawnFn = options.spawn ?? spawn;
  const platform = options.platform ?? process.platform;
  const [command, args] = platform === "darwin" ? ["open", [url]] : platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnFn(command, args, { stdio: "ignore", detached: false });
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.on?.("error", () => finish(false));
    child.on?.("exit", (code) => finish(code === 0));
    child.unref?.();
  });
}
function defaultSleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === "function") timer.unref();
  });
}
function issuerOf(session) {
  if (typeof session?.oidcIssuer === "string" && session.oidcIssuer.startsWith("https://")) return session.oidcIssuer;
  const scope = typeof session?.scope === "string" ? session.scope : "";
  const issuer = scope.split("::")[0];
  if (issuer?.startsWith("https://")) return issuer;
  return XAI_OAUTH_ISSUER;
}
function clientIdOf(session) {
  if (typeof session?.oidcClientId === "string" && session.oidcClientId) return session.oidcClientId;
  const scope = typeof session?.scope === "string" ? session.scope : "";
  const clientId = scope.split("::")[1];
  return clientId || GROK_OIDC_CLIENT_ID;
}
async function defaultRenewSession(options = {}) {
  const env = options.env ?? process.env;
  const path = options.authPath ?? authJsonPath(env);
  const read = options.readAuth ?? (() => readGrokAuthSession(path));
  let parsed;
  try {
    parsed = read();
  } catch {
    return void 0;
  }
  const current = parsed?.session;
  if (!current?.refreshToken) return void 0;
  const issuer = issuerOf(current);
  const clientId = clientIdOf(current);
  const fetchImpl = options.fetch ?? fetch;
  const endpoints = options.endpoints ?? await discoverOauthEndpoints(issuer, { fetch: fetchImpl });
  const nowMs = typeof options.now === "function" ? options.now() : Date.now();
  const tokens = await refreshOauthToken({
    endpoint: endpoints.tokenEndpoint,
    clientId,
    refreshToken: current.refreshToken,
    fetch: fetchImpl,
    now: () => nowMs
  });
  const written = writeOauthSession(path, {
    issuer,
    clientId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || current.refreshToken,
    expiresAt: tokens.expiresAt ?? current.expiresAt,
    email: current.email,
    userId: current.userId
  });
  return written.session;
}
async function defaultCredentialRefOf() {
  try {
    const mod = await optionalImport("@deepseek-ai/dsh-credentials");
    if (typeof mod?.credentialRef === "function") return mod.credentialRef(CREDENTIAL_REF_NAME);
  } catch {
  }
  return CREDENTIAL_REF_NAME;
}
function scheduleDeferred(run) {
  if (typeof setImmediate === "function") setImmediate(run);
  else queueMicrotask(run);
}
function withTimeout(promise, ms, message, options = {}) {
  let timer;
  const shouldUnref = options.unref !== false;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
      if (shouldUnref && typeof timer?.unref === "function") timer.unref();
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
function createSessionService({
  credentials,
  logger,
  onCatalogChange,
  fetchBillingUsage: fetchBilling = fetchBillingUsage,
  loadCatalog: loadCatalogFn = loadCatalog,
  readAuth = readGrokAuthSession,
  storeTokenTimeoutMs = STORE_TOKEN_TIMEOUT_MS,
  credentialsIoTimeoutMs = CREDENTIALS_IO_TIMEOUT_MS,
  credentialRefOf = defaultCredentialRefOf,
  renewSession,
  fetch: fetchImpl,
  authPath,
  env,
  oauthEndpoints,
  now = () => Date.now()
} = {}) {
  const renew = renewSession ?? (() => defaultRenewSession({
    readAuth,
    fetch: fetchImpl,
    authPath,
    env,
    endpoints: oauthEndpoints,
    now
  }));
  let catalog = { models: [], source: "signed-out", error: void 0 };
  let lastPublic = publicSessionView(void 0);
  let lastUsage = unavailable("Not fetched yet");
  let memoryAccessToken;
  let memoryTokenExpiresAt;
  let memorySessionTouched = false;
  const resolveTimeoutMs = () => {
    return typeof storeTokenTimeoutMs === "number" && storeTokenTimeoutMs > 0 ? storeTokenTimeoutMs : STORE_TOKEN_TIMEOUT_MS;
  };
  const resolveIoTimeoutMs = () => {
    return typeof credentialsIoTimeoutMs === "number" && credentialsIoTimeoutMs > 0 ? credentialsIoTimeoutMs : CREDENTIALS_IO_TIMEOUT_MS;
  };
  const epochMs = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    return void 0;
  };
  const adoptSession = (session) => {
    if (!session?.accessToken) return void 0;
    memoryAccessToken = session.accessToken;
    memoryTokenExpiresAt = epochMs(session.expiresAt);
    memorySessionTouched = true;
    lastPublic = publicSessionView(session);
    return memoryAccessToken;
  };
  const memoryTokenNeedsRenewal = () => {
    if (typeof memoryAccessToken !== "string" || memoryAccessToken.length === 0) return false;
    if (typeof memoryTokenExpiresAt !== "number") return false;
    return memoryTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS <= now();
  };
  let renewalInFlight;
  const renewAccessToken = async () => {
    if (renewalInFlight) return renewalInFlight;
    renewalInFlight = (async () => {
      try {
        const session = await renew();
        const token = adoptSession(session);
        if (token) notifyCatalogChange();
        return token;
      } catch (error) {
        logger?.warn?.(
          "Grok subscription session renewal failed: %s",
          error instanceof Error ? error.message : "unknown"
        );
        return void 0;
      } finally {
        renewalInFlight = void 0;
      }
    })();
    return renewalInFlight;
  };
  const notifyCatalogChange = () => {
    scheduleDeferred(() => {
      try {
        onCatalogChange?.();
      } catch (error) {
        logger?.warn?.(
          "Grok subscription catalog change notify failed: %s",
          error instanceof Error ? error.message : "unknown"
        );
      }
    });
  };
  const readStoredToken = async () => {
    if (typeof memoryAccessToken === "string" && memoryAccessToken.length > 0) {
      if (!memoryTokenNeedsRenewal()) return memoryAccessToken;
      const renewed = await renewAccessToken();
      return renewed ?? memoryAccessToken;
    }
    if (memorySessionTouched) return void 0;
    if (!credentials?.resolve) return void 0;
    const timeoutMs = resolveIoTimeoutMs();
    try {
      const hit = await withTimeout(
        (async () => {
          const ref = await credentialRefOf();
          return credentials.resolve(ref);
        })(),
        timeoutMs,
        `Resolving Grok credential timed out after ${timeoutMs}ms`
      );
      const value = hit?.value;
      return typeof value === "string" && value.length > 0 ? value : void 0;
    } catch (error) {
      logger?.warn?.(
        "Grok subscription credential resolve failed: %s",
        error instanceof Error ? error.message : "unknown"
      );
      return void 0;
    }
  };
  const persistToken = async (token) => {
    if (!credentials?.set) throw new Error("DSH credentials service is unavailable");
    const timeoutMs = resolveTimeoutMs();
    await withTimeout(
      (async () => {
        const ref = await credentialRefOf();
        await credentials.set(ref, token);
      })(),
      timeoutMs,
      `Storing Grok credential timed out after ${timeoutMs}ms`
    );
  };
  const clearToken = async () => {
    if (!credentials?.unset) return;
    const timeoutMs = resolveTimeoutMs();
    await withTimeout(
      (async () => {
        const ref = await credentialRefOf();
        await credentials.unset(ref);
      })(),
      timeoutMs,
      `Clearing Grok credential timed out after ${timeoutMs}ms`
    );
  };
  const refreshUsage = async () => {
    const token = await readStoredToken();
    if (!token) {
      lastUsage = unavailable("Not signed in");
      return lastUsage;
    }
    try {
      lastUsage = await fetchBilling(token);
    } catch (error) {
      logger?.warn?.(
        "Grok subscription usage fetch failed: %s",
        error instanceof Error ? error.message : "unknown"
      );
      lastUsage = unavailable("Usage fetch failed");
    }
    return lastUsage;
  };
  const refreshCatalog = async () => {
    const token = await readStoredToken();
    if (!token) {
      catalog = { models: [], source: "signed-out", error: void 0 };
      notifyCatalogChange();
      return catalog;
    }
    catalog = await loadCatalogFn(token);
    notifyCatalogChange();
    return catalog;
  };
  const kickBackgroundUsageRefresh = () => {
    void refreshUsage().catch((error) => {
      logger?.warn?.(
        "Grok subscription background usage refresh failed: %s",
        error instanceof Error ? error.message : "unknown"
      );
    });
  };
  const kickBackgroundCatalogRefresh = () => {
    void refreshCatalog().catch((error) => {
      logger?.warn?.(
        "Grok subscription background catalog refresh failed: %s",
        error instanceof Error ? error.message : "unknown"
      );
    });
  };
  const pull = async () => {
    const parsed = readAuth();
    if (!parsed.session) {
      memoryAccessToken = void 0;
      memorySessionTouched = true;
      catalog = { models: [], source: "signed-out", error: void 0 };
      lastPublic = publicSessionView(void 0);
      lastUsage = unavailable("Not signed in");
      scheduleDeferred(() => {
        void clearToken().catch((error) => {
          logger?.warn?.(
            "Grok subscription deferred credential clear failed: %s",
            error instanceof Error ? error.message : "unknown"
          );
        });
      });
      const message = parsed.reason === "api-key-only" ? "Found an API-key entry only. Sign in with a SuperGrok / X Premium account." : "No Grok Build subscription session in auth.json. Sign in from Settings first.";
      notifyCatalogChange();
      return { ok: false, error: message, account: lastPublic, catalog, usage: lastUsage };
    }
    const accessToken = parsed.session.accessToken;
    memoryAccessToken = accessToken;
    memoryTokenExpiresAt = epochMs(parsed.session.expiresAt);
    memorySessionTouched = true;
    lastPublic = publicSessionView(parsed.session);
    scheduleDeferred(() => {
      void persistToken(accessToken).catch((error) => {
        logger?.warn?.(
          "Grok subscription deferred credential persist failed: %s",
          error instanceof Error ? error.message : "unknown"
        );
      });
    });
    notifyCatalogChange();
    kickBackgroundCatalogRefresh();
    kickBackgroundUsageRefresh();
    return { ok: true, account: lastPublic, catalog, usage: lastUsage };
  };
  const snapshot = () => ({ account: lastPublic, catalog, usage: lastUsage, authPath: authPath ?? authJsonPath(env) });
  const status = async () => {
    if (typeof memoryAccessToken === "string" && memoryAccessToken.length > 0 || lastPublic.signedIn === true) {
      return snapshot();
    }
    try {
      const parsed = readAuth();
      if (parsed.session) {
        adoptSession(parsed.session);
        return snapshot();
      }
    } catch (error) {
      logger?.warn?.(
        "Grok subscription auth.json read failed during status: %s",
        error instanceof Error ? error.message : "unknown"
      );
    }
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
      lastUsage = unavailable("Not signed in");
      return snapshot();
    }
    memoryAccessToken = token;
    lastPublic = Object.freeze({ signedIn: true, maskedAccount: "\u2022\u2022\u2022\u2022", authMode: "oidc", source: "dsh-credentials" });
    return snapshot();
  };
  let loginEpoch = 0;
  const login = async (loginOptions) => {
    const epoch = ++loginEpoch;
    const fetchLogin = loginOptions?.fetch ?? fetchImpl ?? fetch;
    const path = loginOptions?.authPath ?? authPath ?? authJsonPath(env);
    const sleep = loginOptions?.sleep ?? defaultSleep;
    const openUrl = loginOptions?.openUrl ?? ((url) => openExternal(url, { spawn: loginOptions?.openSpawn }));
    const clock = () => typeof loginOptions?.now === "function" ? loginOptions.now() : now();
    let endpoints;
    let device;
    try {
      endpoints = loginOptions?.endpoints ?? oauthEndpoints ?? await discoverOauthEndpoints(XAI_OAUTH_ISSUER, { fetch: fetchLogin });
      device = await requestDeviceAuthorization({
        endpoint: endpoints.deviceAuthorizationEndpoint,
        fetch: fetchLogin
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start sign-in";
      return { ok: false, error: message, ...await status() };
    }
    const loginUrl = device.verificationUriComplete || device.verificationUri;
    if (!isXaiHttpsUrl(loginUrl) || !device.userCode || !device.deviceCode) {
      return { ok: false, error: "Sign-in did not return a verification link.", ...await status() };
    }
    try {
      void openUrl(loginUrl);
    } catch {
    }
    const deadline = clock() + (typeof device.expiresIn === "number" && device.expiresIn > 0 ? device.expiresIn : 900) * 1e3;
    let interval = Number.isFinite(device.interval) && device.interval >= 0 ? device.interval : 5;
    const poll = async () => {
      try {
        while (epoch === loginEpoch) {
          if (clock() >= deadline) {
            logger?.warn?.("Grok subscription sign-in timed out before authorization");
            return;
          }
          await sleep(interval * 1e3);
          if (epoch !== loginEpoch) return;
          const result = await exchangeDeviceCode({
            endpoint: endpoints.tokenEndpoint,
            deviceCode: device.deviceCode,
            fetch: fetchLogin,
            now: clock
          });
          if (epoch !== loginEpoch) return;
          if (result.kind === "pending") continue;
          if (result.kind === "slow_down") {
            interval += 5;
            continue;
          }
          if (result.kind !== "ok") {
            logger?.warn?.("Grok subscription sign-in stopped: %s", result.error ?? "unknown");
            return;
          }
          writeOauthSession(path, {
            issuer: result.issuer,
            clientId: result.clientId,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: result.expiresAt
          });
          if (epoch !== loginEpoch) return;
          await pull();
          return;
        }
      } catch (error) {
        logger?.warn?.(
          "Grok subscription sign-in failed: %s",
          error instanceof Error ? error.message : "unknown"
        );
      } finally {
        try {
          loginOptions?.onSettled?.();
        } catch {
        }
      }
    };
    void poll();
    return { ok: true, pending: true, loginUrl, userCode: device.userCode, ...await status() };
  };
  const logout = async () => {
    loginEpoch += 1;
    memoryAccessToken = void 0;
    memorySessionTouched = true;
    await clearToken().catch((error) => {
      logger?.warn?.(
        "Grok subscription credential clear failed: %s",
        error instanceof Error ? error.message : "unknown"
      );
    });
    catalog = { models: [], source: "signed-out", error: void 0 };
    lastPublic = publicSessionView(void 0);
    lastUsage = unavailable("Not signed in");
    notifyCatalogChange();
    return { ok: true, account: lastPublic, catalog, usage: lastUsage };
  };
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
    publicAccount: () => lastPublic
  };
}

// src/plugin-version.js
import { spawn as spawn2 } from "node:child_process";
import { existsSync as existsSync3 } from "node:fs";
import { readdir, readFile, realpath } from "node:fs/promises";
import { homedir as homedir3 } from "node:os";
import { join as join3 } from "node:path";
import { fileURLToPath } from "node:url";
var PACKAGE_NAME = PLUGIN_ID;
var NPM_REGISTRY_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
var DEFAULT_VERSION_TTL_MS = 5 * 6e4;
var DEFAULT_VERSION_TIMEOUT_MS = 1e4;
var DEFAULT_UPDATE_TIMEOUT_MS = 18e4;
var DEFAULT_SETTLE_DELAY_MS = 250;
var UPDATE_RELEASE_AGE_MINUTES = 0;
var clone = (value) => structuredClone(value);
function parseSemver(value) {
  if (typeof value !== "string") return void 0;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(value.trim());
  if (match === null) return void 0;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] };
}
function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left === void 0 || right === void 0) return void 0;
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === void 0) return 1;
  if (right.pre === void 0) return -1;
  return left.pre < right.pre ? -1 : 1;
}
function classifySpec(spec) {
  if (typeof spec !== "string" || spec === "") return "unknown";
  if (/^(?:link|file):/u.test(spec)) return "link";
  if (/^(?:\d|[~^*])/u.test(spec)) return "npm";
  return "unknown";
}
var readManifest = async (path) => {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : void 0;
  } catch {
    return void 0;
  }
};
async function confirmInstalled({ profileDir, expected, settleDelayMs, attempts = 3 }) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const installed = (await readManifest(join3(profileDir, "node_modules", PACKAGE_NAME, "package.json")))?.version;
    if (installed === expected) return;
    if (attempt < attempts) await new Promise((resolve) => {
      setTimeout(resolve, settleDelayMs);
    });
  }
  throw new Error("Grok plugin update did not install the requested version");
}
async function findInstall({ dshHome, ownPackageJsonUrl }) {
  let ownReal;
  try {
    ownReal = await realpath(fileURLToPath(ownPackageJsonUrl));
  } catch {
    ownReal = void 0;
  }
  let entries = [];
  try {
    entries = await readdir(join3(dshHome, "profiles"), { withFileTypes: true });
  } catch {
    entries = [];
  }
  const declared = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profileDir = join3(dshHome, "profiles", entry.name);
    const spec = (await readManifest(join3(profileDir, "package.json")))?.dependencies?.[PACKAGE_NAME];
    if (typeof spec !== "string") continue;
    declared.push({ profile: entry.name, spec });
    if (ownReal === void 0) continue;
    try {
      const installed = await realpath(join3(profileDir, "node_modules", PACKAGE_NAME, "package.json"));
      if (installed === ownReal) return { kind: classifySpec(spec), profile: entry.name };
    } catch {
    }
  }
  if (declared.length === 1) return { kind: classifySpec(declared[0].spec), profile: declared[0].profile };
  return { kind: "unknown" };
}
var isExistingPath = (value) => typeof value === "string" && value !== "" && existsSync3(value);
var PNPM_SCRIPT = /[\\/]pnpm\.(?:mjs|cjs|js)$/u;
var dshRuntimeRoot = (value) => isExistingPath(value) && existsSync3(join3(value, "node_modules", "@deepseek-ai", "dsh", "package.json")) ? value : void 0;
function resolvePnpm({ argv } = {}) {
  const entries = Array.isArray(argv) ? argv : [];
  for (const entry of entries) {
    if (isExistingPath(entry) && PNPM_SCRIPT.test(entry)) return entry;
  }
  for (const entry of entries) {
    const root = dshRuntimeRoot(entry);
    if (root === void 0) continue;
    const script = join3(root, "..", "pnpm", "bin", "pnpm.mjs");
    if (existsSync3(script)) return script;
  }
  return void 0;
}
function resolveLauncher({ argv, execPath }) {
  const pnpm = resolvePnpm({ argv });
  if (pnpm === void 0) return { command: "pnpm", prefix: [] };
  return { command: execPath, prefix: [pnpm] };
}
function spawnRunCommand({ command, args, cwd }, { signal, timeoutMs }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Grok plugin update aborted"));
      return;
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Grok plugin update timed out")), timeoutMs);
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback(value);
    };
    let child;
    try {
      child = spawn2(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        signal: controller.signal,
        ...cwd === void 0 ? {} : { cwd }
      });
    } catch (error) {
      settle(reject, error);
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout = (stdout + chunk).slice(-8192);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-8192);
    });
    child.on("error", (error) => settle(reject, error));
    child.on("close", (code) => {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        settle(reject, reason instanceof Error ? reason : new Error("Grok plugin update aborted"));
        return;
      }
      settle(resolve, { code: code ?? 1, stdout, stderr });
    });
  });
}
function createGrokPluginManager({
  fetchImpl = globalThis.fetch,
  runCommand = spawnRunCommand,
  execPath = process.execPath,
  argv = process.argv,
  env = process.env,
  ownPackageJsonUrl = new URL("../package.json", import.meta.url),
  registryUrl = NPM_REGISTRY_LATEST_URL,
  now = Date.now,
  ttlMs = DEFAULT_VERSION_TTL_MS,
  timeoutMs = DEFAULT_VERSION_TIMEOUT_MS,
  updateTimeoutMs = DEFAULT_UPDATE_TIMEOUT_MS,
  settleDelayMs = DEFAULT_SETTLE_DELAY_MS
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Grok plugin manager requires fetch");
  if (typeof runCommand !== "function") throw new Error("Grok plugin manager requires runCommand");
  const dshHome = typeof env.DSH_HOME === "string" && env.DSH_HOME !== "" ? env.DSH_HOME : join3(homedir3(), ".dsh");
  const launcher = resolveLauncher({ argv, execPath });
  let cached;
  let inFlight;
  let generation = 0;
  let updating = false;
  const fetchLatest = async (signal) => {
    const timeoutSignal2 = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal === void 0 ? timeoutSignal2 : AbortSignal.any([signal, timeoutSignal2]);
    let response;
    try {
      response = await fetchImpl(registryUrl, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: requestSignal
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error("Grok plugin version check failed");
    }
    if (!response.ok) throw new Error("Grok plugin version check failed");
    let version;
    try {
      version = (await readResponseJson(response))?.version;
    } catch {
      version = void 0;
    }
    if (parseSemver(version) === void 0) throw new Error("Grok plugin version check failed");
    return version;
  };
  const readOwnVersion = async () => {
    const version = (await readManifest(fileURLToPath(ownPackageJsonUrl)))?.version;
    if (parseSemver(version) === void 0) throw new Error("Grok plugin version is unavailable");
    return version;
  };
  const load = async (signal) => {
    signal?.throwIfAborted();
    const [current, install, latest] = await Promise.all([
      readOwnVersion(),
      findInstall({ dshHome, ownPackageJsonUrl }),
      fetchLatest(signal)
    ]);
    return {
      current,
      latest,
      updateAvailable: compareSemver(latest, current) === 1,
      install,
      fetchedAt: now()
    };
  };
  return Object.freeze({
    async read({ force = false, signal } = {}) {
      signal?.throwIfAborted();
      if (!force && cached !== void 0 && now() - cached.fetchedAt < ttlMs) return clone(cached);
      const createPending = (requestSignal) => {
        const observedGeneration = generation;
        return load(requestSignal).then((value) => {
          if (generation === observedGeneration) cached = value;
          return value;
        });
      };
      if (force) return clone(await createPending(signal));
      const pending = inFlight ?? createPending();
      if (inFlight === void 0) {
        inFlight = pending;
        const clear = () => {
          if (inFlight === pending) inFlight = void 0;
        };
        void pending.then(clear, clear);
      }
      return clone(await (signal === void 0 ? pending : Promise.race([
        pending,
        new Promise((_, reject) => {
          const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new Error("Grok plugin version check aborted"));
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        })
      ])));
    },
    async update({ signal } = {}) {
      signal?.throwIfAborted();
      if (updating) throw new Error("Grok plugin update is already running");
      updating = true;
      try {
        const install = await findInstall({ dshHome, ownPackageJsonUrl });
        if (install.kind === "link") throw new Error("Grok plugin is installed from a local checkout");
        if (install.kind !== "npm" || install.profile === void 0) {
          throw new Error("Grok plugin update could not find the owning profile");
        }
        const latest = await fetchLatest(signal);
        const profileDir = join3(dshHome, "profiles", install.profile);
        let result;
        try {
          result = await runCommand({
            command: launcher.command,
            // `pnpm add <exact version>` is what `dsh plugin add` performs for a
            // registry spec. `--save-exact` keeps the profile dependency pinned,
            // and the release-age override stops a just-published version from
            // being skipped as too new (pnpm ≥ 10.16; unknown keys are ignored).
            args: [
              ...launcher.prefix,
              "add",
              "--save-exact",
              `--config.minimumReleaseAge=${UPDATE_RELEASE_AGE_MINUTES}`,
              `${PACKAGE_NAME}@${latest}`
            ],
            cwd: profileDir
          }, { signal, timeoutMs: updateTimeoutMs });
        } catch (error) {
          if (signal?.aborted) throw error;
          throw new Error("Grok plugin update failed");
        }
        if (result.code !== 0) throw new Error("Grok plugin update failed");
        await confirmInstalled({ profileDir, expected: latest, settleDelayMs });
        generation += 1;
        cached = void 0;
        return { version: latest, profile: install.profile };
      } finally {
        updating = false;
      }
    },
    invalidate() {
      generation += 1;
      cached = void 0;
    }
  });
}

// src/rpc-contract.js
var RPC_ENDPOINTS = Object.freeze([
  "status",
  "login/cli",
  "login/device",
  "pull",
  "logout",
  "catalog/refresh",
  "usage",
  "usage/refresh",
  "plugin/version",
  "plugin/update"
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
  delete next.refreshToken;
  delete next.refresh_token;
  delete next.deviceCode;
  delete next.device_code;
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
  if (next.usage) {
    next.usage = sanitizeUsage(next.usage);
  }
  return next;
}
function sanitizeUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return { status: "unavailable", reason: "Usage unavailable", experimental: true, source: "billing-credits-undocumented" };
  }
  const out = {
    status: usage.status === "ok" ? "ok" : "unavailable",
    experimental: true,
    source: typeof usage.source === "string" ? usage.source : "billing-credits-undocumented"
  };
  if (out.status !== "ok") {
    out.reason = typeof usage.reason === "string" ? usage.reason : "Usage unavailable";
    if (typeof usage.code === "string") out.code = usage.code;
    for (const field of ["periodStart", "periodStartLocal", "periodEnd", "periodEndLocal"]) {
      if (typeof usage[field] === "string") out[field] = usage[field];
    }
    return out;
  }
  if (typeof usage.usedPercent === "number" && Number.isFinite(usage.usedPercent)) out.usedPercent = usage.usedPercent;
  if (typeof usage.remainingPercent === "number" && Number.isFinite(usage.remainingPercent)) out.remainingPercent = usage.remainingPercent;
  if (typeof usage.periodStart === "string") out.periodStart = usage.periodStart;
  if (typeof usage.periodStartLocal === "string") out.periodStartLocal = usage.periodStartLocal;
  if (typeof usage.periodEnd === "string") out.periodEnd = usage.periodEnd;
  if (typeof usage.periodEndLocal === "string") out.periodEndLocal = usage.periodEndLocal;
  if (typeof usage.fetchedAt === "string") out.fetchedAt = usage.fetchedAt;
  if (usage.percentSource === "omitted-zero") out.percentSource = "omitted-zero";
  if (Array.isArray(usage.productUsage)) {
    out.productUsage = usage.productUsage.filter((row) => row && typeof row === "object").map((row) => ({
      ...typeof row.name === "string" ? { name: row.name } : {},
      ...typeof row.usedPercent === "number" && Number.isFinite(row.usedPercent) ? { usedPercent: row.usedPercent } : {}
    }));
  }
  return out;
}
function publicPluginVersion(value) {
  const installKind = value?.install?.kind;
  return {
    current: value.current,
    latest: value.latest,
    updateAvailable: value.updateAvailable === true,
    install: {
      kind: installKind === "npm" || installKind === "link" ? installKind : "unknown"
    }
  };
}
async function dispatch(session, endpoint, diagnostics, payload, signal, pluginManager) {
  if (endpoint === "status") {
    const status = await session.status();
    return publicResult(stripSecrets({
      ...status,
      // Which adapter is actually serving this route: the host's official
      // pi-ai implementation or the bundled fallback. Diagnosing "model does
      // not support images" starts here.
      diagnostics: typeof diagnostics === "function" ? diagnostics() : diagnostics
    }));
  }
  if (endpoint === "pull") return publicResult(stripSecrets(await session.pull()));
  if (endpoint === "logout") return publicResult(stripSecrets(await session.logout()));
  if (endpoint === "catalog/refresh") {
    const catalog = await session.refreshCatalog();
    return publicResult(stripSecrets({ catalog, account: session.publicAccount(), usage: session.usage?.() }));
  }
  if (endpoint === "usage") {
    return publicResult(stripSecrets({ usage: session.usage?.() ?? { status: "unavailable", reason: "Usage unavailable", experimental: true } }));
  }
  if (endpoint === "usage/refresh") {
    const usage = await session.refreshUsage();
    return publicResult(stripSecrets({ usage, account: session.publicAccount() }));
  }
  if (endpoint === "login/cli") return publicResult(stripSecrets(await session.login({ device: false })));
  if (endpoint === "login/device") return publicResult(stripSecrets(await session.login({ device: true })));
  if (endpoint === "plugin/version" || endpoint === "plugin/update") {
    if (!pluginManager) return publicError(new Error("Grok plugin update is unavailable"));
    if (endpoint === "plugin/version") {
      return publicResult(publicPluginVersion(await pluginManager.read({
        force: payload?.force === true,
        signal
      })));
    }
    const updated = await pluginManager.update({ signal });
    return publicResult({ version: updated.version });
  }
  return publicError(new Error(`Unknown Grok subscription RPC: ${endpoint}`));
}
function createRpcHandler(session, options = {}) {
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : RPC_HANDLER_TIMEOUT_MS;
  const loginTimeoutMs = typeof options.loginTimeoutMs === "number" && options.loginTimeoutMs > 0 ? options.loginTimeoutMs : LOGIN_HANDLER_TIMEOUT_MS;
  return async function handle(endpoint, payload, signal) {
    try {
      const operation = dispatch(session, endpoint, options.diagnostics, payload, signal, options.pluginManager);
      if (endpoint === "plugin/update") return await operation;
      const ceiling = endpoint === "login/cli" || endpoint === "login/device" ? loginTimeoutMs : timeoutMs;
      return await withTimeout(
        operation,
        ceiling,
        `Grok subscription RPC "${endpoint}" timed out after ${ceiling}ms`,
        { unref: false }
      );
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
var cachedClientRequestSchema;
var schemaLoadStarted = false;
function kickSchemaLoad() {
  if (schemaLoadStarted) return;
  schemaLoadStarted = true;
  void optionalImport("@deepseek-ai/dsh-client-connection").then((mod) => {
    if (mod?.clientRequestSchema && typeof mod.clientRequestSchema.safeParse === "function") {
      cachedClientRequestSchema = mod.clientRequestSchema;
    }
  }).catch(() => {
  });
}
function resolveEnvelope(body, method) {
  const schema = cachedClientRequestSchema;
  if (schema) {
    const envelope = schema.safeParse(body);
    if (!envelope.success || envelope.data.method !== method) return void 0;
    return { rpcId: envelope.data.rpcId, payload: envelope.data.payload };
  }
  return parseEnvelope(body, method);
}
function registerSubscriptionTransport(connection, handler) {
  kickSchemaLoad();
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
          if (!cachedClientRequestSchema) {
            try {
              const mod = await optionalImport("@deepseek-ai/dsh-client-connection");
              if (mod?.clientRequestSchema && typeof mod.clientRequestSchema.safeParse === "function") {
                cachedClientRequestSchema = mod.clientRequestSchema;
              }
            } catch {
            }
          }
          const envelope = resolveEnvelope(body, method);
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

// src/index.js
var name = CORDIS_ID;
var inject = ["llm", "web"];
function scheduleDeferred2(run) {
  if (typeof setImmediate === "function") setImmediate(run);
  else queueMicrotask(run);
}
function softService(ctx, key) {
  try {
    if (typeof ctx.get === "function") return ctx.get(key) ?? void 0;
  } catch {
  }
  return void 0;
}
function attachmentResolver(ctx) {
  return () => {
    try {
      return typeof ctx.get === "function" ? ctx.get("attachments") : void 0;
    } catch {
      return void 0;
    }
  };
}
function apply(ctx, options = {}) {
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
    scheduleDeferred2(() => {
      if (!active) return;
      try {
        ctx.emit("llm/adapters-updated");
      } catch (error) {
        ctx.logger?.warn?.("an llm/adapters-updated listener failed");
        ctx.logger?.warn?.(error);
      }
    });
  };
  const credentials = softService(ctx, "credentials");
  const session = createSessionService({
    credentials,
    logger: ctx.logger,
    onCatalogChange: notifyCatalogChange
  });
  const adapterState = { kind: "starting" };
  const pluginManager = options.pluginManager ?? createGrokPluginManager();
  const handler = createRpcHandler(session, {
    pluginManager,
    diagnostics: () => ({
      adapter: adapterState.kind,
      imageInput: typeof resolveAttachments()?.readImageRequest === "function",
      hostPeersResolved: adapterState.kind === "pi-ai"
    })
  });
  const resolveAttachments = attachmentResolver(ctx);
  const defer = options.defer ?? scheduleDeferred2;
  defer(() => {
    void deferredBoot(ctx, session, notifyCatalogChange, options, adapterState);
  });
  ctx.inject(["connection"], (connectionContext) => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    "grok-subscription: host-only account RPC"
  ));
}
async function deferredBoot(ctx, session, notifyCatalogChange, options = {}, adapterState) {
  if (!options.skipSettings) {
    await tryRegisterSettings(ctx);
  }
  try {
    ctx.llm.registerConfigurableProviders?.([{
      provider: PROVIDER_ID,
      displayName: DISPLAY_NAME,
      settingsNs: SETTINGS_NAMESPACE,
      settingsPath: []
    }]);
  } catch (error) {
    ctx.logger?.debug?.(
      "Grok subscription provider directory skipped: %s",
      error instanceof Error ? error.message : "unknown"
    );
  }
  if (!options.skipPull) {
    void session.pull().catch((error) => {
      ctx.logger?.debug?.(
        "Grok subscription startup pull skipped: %s",
        error instanceof Error ? error.message : "unknown"
      );
    });
  }
  if (options.skipAdapter) {
    adapterState.kind = "unavailable";
    return;
  }
  const buildAdapter = options.buildAdapter ?? createGrokBuildAdapter;
  try {
    const created = await buildAdapter(session, {
      ...options.adapterOptions,
      resolveAttachments: attachmentResolver(ctx)
    });
    if (!created?.adapter) {
      adapterState.kind = "unavailable";
      ctx.logger?.warn?.(
        "Grok subscription adapter is unavailable: %s",
        created?.note ?? "unknown"
      );
      return;
    }
    if (created.note) ctx.logger?.warn?.(created.note);
    ctx.llm.registerAdapter([PROVIDER_ID], created.adapter);
    adapterState.kind = created.kind ?? "pi-ai";
    notifyCatalogChange?.();
  } catch (error) {
    adapterState.kind = "unavailable";
    ctx.logger?.warn?.(
      "Grok subscription adapter registration failed: %s",
      error instanceof Error ? error.message : "unknown"
    );
  }
}
async function tryRegisterSettings(ctx) {
  const settings = softService(ctx, "settings");
  if (typeof settings?.register !== "function") return;
  try {
    const mod = await optionalImport("@deepseek-ai/schemastery");
    if (!mod) {
      ctx.logger?.debug?.("Grok subscription settings namespace skipped: schemastery unavailable or timed out");
      return;
    }
    const z = mod.default ?? mod;
    settings.register(SETTINGS_NAMESPACE, z.object({}));
  } catch (error) {
    ctx.logger?.debug?.(
      "Grok subscription settings namespace skipped: %s",
      error instanceof Error ? error.message : "unknown"
    );
  }
}
export {
  DISPLAY_NAME,
  DISPLAY_NAME_ZH,
  PROVIDER_ID,
  apply,
  deferredBoot,
  inject,
  name,
  scheduleDeferred2 as scheduleDeferred,
  softService
};
