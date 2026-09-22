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
var BILLING_CREDITS_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
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
var USAGE_TIMEOUT_MS = 8e3;
var STORE_TOKEN_TIMEOUT_MS = 5e3;
var STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1e3;
var MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
var FALLBACK_MODEL_IDS = Object.freeze(["grok-4.7", "grok-4.6", "grok-4.5"]);
var IMPORT_TIMEOUT_MS = 2500;
var CREDENTIALS_IO_TIMEOUT_MS = 1500;
var RPC_HANDLER_TIMEOUT_MS = 8e3;

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
function reasoningInfoOf(model) {
  if (model?.reasoning === false) return void 0;
  const efforts = Array.isArray(model?.reasoningEfforts) && model.reasoningEfforts.length ? model.reasoningEfforts : ["low", "medium", "high", "xhigh"];
  const title = (id) => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
  const preferred = model?.defaultEffort && efforts.includes(model.defaultEffort) ? model.defaultEffort : efforts.includes("high") ? "high" : efforts[efforts.length - 1];
  return {
    efforts: efforts.map((id) => ({ id, name: title(id) })),
    defaultEffort: preferred
  };
}
function toLlmModels(models) {
  return models.map((model) => {
    const info = {
      provider: PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: ["text"]
    };
    const reasoning = reasoningInfoOf(model);
    if (reasoning) info.reasoning = reasoning;
    return info;
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

// src/usage.js
var USAGE_SOURCE = "billing-credits-undocumented";
var SHANGHAI_TZ = "Asia/Shanghai";
function unavailable(reason) {
  return Object.freeze({
    status: "unavailable",
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : "Usage unavailable",
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
function parseBillingCredits(body) {
  if (body === null || body === void 0) {
    return unavailable("Empty billing response");
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    return unavailable("Unexpected billing response shape");
  }
  const usedPercent = resolveUsedPercent(body);
  if (usedPercent === void 0) {
    return unavailable(missingPercentReason(body));
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
    ...periodStart ? { periodStart, periodStartLocal: formatShanghai(periodStart) } : {},
    ...periodEnd ? { periodEnd, periodEndLocal: formatShanghai(periodEnd) } : {},
    ...productUsage ? { productUsage } : {}
  });
}
function parseBillingCreditsJson(text) {
  if (typeof text !== "string") return unavailable("Non-text billing response");
  if (!text.trim()) return unavailable("Empty billing response");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return unavailable("Invalid JSON from billing API");
  }
  return parseBillingCredits(body);
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
    text = await response.text();
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
async function optionalImport(specifier, options = {}) {
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : IMPORT_TIMEOUT_MS;
  const importFn = typeof options.importFn === "function" ? options.importFn : (id) => import(id);
  try {
    return await withImportTimeout(
      Promise.resolve(importFn(specifier)),
      timeoutMs,
      `Import timed out after ${timeoutMs}ms: ${specifier}`
    );
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
      const text2 = textOf(message.content);
      if (text2) input.push({ role: "assistant", content: text2 });
      continue;
    }
    const text = textOf(message.content);
    if (!text) continue;
    input.push({ role, content: text });
  }
  return input;
}
function mapFinish(reason) {
  if (reason === "toolUse" || reason === "tool_calls") return { kind: "tool-calls" };
  if (reason === "length" || reason === "max_tokens") return { kind: "max-tokens" };
  return { kind: "stop" };
}
function finiteOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function jsonSafeChunk(value) {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number") return Number.isFinite(value) && !Object.is(value, -0) ? value : void 0;
  if (type !== "object") return void 0;
  if (Array.isArray(value)) {
    const list = [];
    for (const item of value) {
      const safe = jsonSafeChunk(item);
      if (safe !== void 0) list.push(safe);
    }
    return list;
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const safe = jsonSafeChunk(item);
    if (safe !== void 0) out[key] = safe;
  }
  return out;
}
async function* streamResponsesUnsafe(options, token) {
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
  if (options.reasoningEffort) {
    body.reasoning = { effort: options.reasoningEffort };
    body.include = ["reasoning.encrypted_content"];
  }
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
  let textContent = "";
  let reasoningContent = "";
  let nextIndex = 0;
  const toolBlocks = /* @__PURE__ */ new Map();
  const toolNames = /* @__PURE__ */ new Map();
  let usage;
  let finish = { kind: "stop" };
  const toolIdOf = (payload) => {
    const id = payload?.item_id ?? payload?.call_id ?? payload?.id;
    return typeof id === "string" && id ? id : void 0;
  };
  const learnToolName = (id, name2) => {
    if (typeof id !== "string" || !id || typeof name2 !== "string" || !name2) return;
    toolNames.set(id, name2);
    const tool = toolBlocks.get(id);
    if (tool) tool.name = name2;
  };
  const adoptToolArguments = (id, value) => {
    if (typeof id !== "string" || typeof value !== "string" || !value) return;
    const tool = toolBlocks.get(id);
    if (tool && value.length > tool.arguments.length) tool.arguments = value;
  };
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
      textContent += delta;
      yield { type: "text-delta", index: textIndex, text: String(delta) };
      return;
    }
    if (type === "response.reasoning_text.delta" || type === "response.reasoning.delta" || type === "response.reasoning_summary_text.delta") {
      const delta = payload.delta ?? payload.text ?? "";
      if (!delta) return;
      if (reasoningIndex === void 0) {
        reasoningIndex = nextIndex++;
        yield { type: "block-start", index: reasoningIndex, blockType: "reasoning" };
      }
      reasoningContent += delta;
      yield { type: "reasoning-delta", index: reasoningIndex, text: String(delta) };
      return;
    }
    if (type === "response.output_item.added" || type === "response.output_item.done") {
      const item = payload.item;
      if (item?.type === "function_call") {
        learnToolName(item.id, item.name);
        learnToolName(item.call_id, item.name);
        adoptToolArguments(item.id, item.arguments);
      }
      return;
    }
    if (type === "response.function_call_arguments.done") {
      const id = toolIdOf(payload);
      learnToolName(id, payload.name);
      adoptToolArguments(id, payload.arguments);
      return;
    }
    if (type === "response.function_call_arguments.delta") {
      const id = toolIdOf(payload);
      if (!id) return;
      let tool = toolBlocks.get(id);
      if (!tool) {
        tool = {
          index: nextIndex++,
          id,
          // Never leave this undefined: an unserializable chunk aborts the turn.
          name: toolNames.get(id) ?? "tool",
          arguments: ""
        };
        toolBlocks.set(id, tool);
        yield { type: "block-start", index: tool.index, blockType: "tool-call" };
      }
      const delta = payload.delta ?? payload.arguments ?? "";
      tool.arguments += delta;
      yield { type: "tool-call-delta", index: tool.index, id, name: tool.name, argumentsDelta: String(delta) };
      return;
    }
    if (type === "response.completed") {
      for (const item of payload.response?.output ?? []) {
        if (item?.type !== "function_call") continue;
        learnToolName(item.id, item.name);
        learnToolName(item.call_id, item.name);
        const id = typeof item.id === "string" && item.id ? item.id : void 0;
        if (id && !toolBlocks.has(id)) {
          const tool = { index: nextIndex++, id, name: toolNames.get(id) ?? "tool", arguments: "" };
          toolBlocks.set(id, tool);
          yield { type: "block-start", index: tool.index, blockType: "tool-call" };
        }
        adoptToolArguments(id, item.arguments);
      }
      const responseUsage = payload.response?.usage ?? payload.usage;
      if (responseUsage) {
        usage = {
          inputTokens: finiteOr(responseUsage.input_tokens ?? responseUsage.prompt_tokens, 0),
          outputTokens: finiteOr(responseUsage.output_tokens ?? responseUsage.completion_tokens, 0)
        };
        usage.totalTokens = finiteOr(responseUsage.total_tokens, usage.inputTokens + usage.outputTokens);
      }
      finish = mapFinish(payload.response?.status === "incomplete" ? "length" : "stop");
      if (toolBlocks.size) finish = { kind: "tool-calls" };
    }
    if (type === "response.failed" || type === "error") {
      const raw2 = payload.error?.message ?? payload.message;
      const failure = {
        message: typeof raw2 === "string" && raw2 ? raw2 : "Grok Build stream failed",
        code: "PROVIDER"
      };
      const status = finiteOr(payload.error?.status, void 0);
      if (status !== void 0) failure.status = status;
      finish = { kind: "error", failure };
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
    yield { type: "block-end", index: reasoningIndex, block: { type: "reasoning", text: reasoningContent } };
  }
  if (textIndex !== void 0) {
    yield { type: "block-end", index: textIndex, block: { type: "text", text: textContent } };
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
async function* streamResponses(options, token) {
  for await (const chunk of streamResponsesUnsafe(options, token)) {
    const safe = jsonSafeChunk(chunk);
    if (safe) yield safe;
  }
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
      const raw = session.publicAccount()?.signedIn === true ? session.models().find((item) => item.id === model) : void 0;
      const info = {
        provider,
        id: model,
        name: found?.name ?? model,
        inputModalities: ["text"],
        context: { contextWindow: raw?.contextWindow ?? 5e5 }
      };
      const reasoning = reasoningInfoOf(raw);
      if (reasoning) info.reasoning = reasoning;
      else if (found?.reasoning) info.reasoning = found.reasoning;
      return info;
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
        const failure = {
          message: error instanceof Error ? error.message : "Grok Build request failed",
          code: aborted ? "ABORTED" : "PROVIDER"
        };
        const status = finiteOr(error?.status, void 0);
        if (status !== void 0) failure.status = status;
        yield { type: "finish", reason: { kind: aborted ? "aborted" : "error", failure } };
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
function withEncryptedReasoningInclude(api) {
  const inject2 = (options) => ({
    ...options,
    samplingParams: {
      ...options?.samplingParams,
      include: ["reasoning.encrypted_content"]
    }
  });
  return {
    stream: (model, context, options) => api.stream(model, context, inject2(options)),
    streamSimple: (model, context, options) => api.streamSimple(model, context, inject2(options))
  };
}
function wrapAsHostAdapter(candidate, dshLlm) {
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
}
function createGrokBuildAdapterSync(session, options = {}) {
  const duck = createDuckAdapter(session);
  const dshLlm = options.dshLlm;
  return {
    adapter: wrapAsHostAdapter(duck, dshLlm),
    kind: "custom-mvp",
    note: "Registered a sync duck Responses adapter; pi-ai upgrade may follow in the background."
  };
}
async function createGrokBuildAdapter(session, options = {}) {
  const importOpts = options.importOptions ?? {};
  const [piAi, dshPi, dshLlm] = await Promise.all([
    optionalImport("@earendil-works/pi-ai", importOpts),
    optionalImport("@deepseek-ai/dsh-llm-pi-ai", importOpts),
    optionalImport("@deepseek-ai/dsh-llm", importOpts)
  ]);
  const duck = createDuckAdapter(session);
  const asHostAdapter = (candidate) => wrapAsHostAdapter(candidate, dshLlm);
  if (!piAi?.createProvider || !dshPi?.PiAiAdapter) {
    return {
      adapter: asHostAdapter(duck),
      kind: "custom-mvp",
      note: "PiAiAdapter or @earendil-works/pi-ai is not available in this host; using a documented custom Responses adapter."
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
    return { adapter: asHostAdapter(duck), kind: "custom-mvp", note: "openai-responses API module is unavailable; using the custom adapter." };
  }
  responsesApi = withEncryptedReasoningInclude(responsesApi);
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
  credentialRefOf = defaultCredentialRefOf
} = {}) {
  let catalog = { models: [], source: "signed-out", error: void 0 };
  let lastPublic = publicSessionView(void 0);
  let lastUsage = unavailable("Not fetched yet");
  let memoryAccessToken;
  let memorySessionTouched = false;
  const resolveTimeoutMs = () => {
    return typeof storeTokenTimeoutMs === "number" && storeTokenTimeoutMs > 0 ? storeTokenTimeoutMs : STORE_TOKEN_TIMEOUT_MS;
  };
  const resolveIoTimeoutMs = () => {
    return typeof credentialsIoTimeoutMs === "number" && credentialsIoTimeoutMs > 0 ? credentialsIoTimeoutMs : CREDENTIALS_IO_TIMEOUT_MS;
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
      return memoryAccessToken;
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
      const message = parsed.reason === "api-key-only" ? "Found an API-key entry only. Sign in with SuperGrok / X Premium via grok login." : "No Grok Build subscription session in auth.json. Run grok login first.";
      notifyCatalogChange();
      return { ok: false, error: message, account: lastPublic, catalog, usage: lastUsage };
    }
    const accessToken = parsed.session.accessToken;
    memoryAccessToken = accessToken;
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
  const status = async () => {
    if (typeof memoryAccessToken === "string" && memoryAccessToken.length > 0 || lastPublic.signedIn === true) {
      return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() };
    }
    try {
      const parsed = readAuth();
      if (parsed.session) {
        memoryAccessToken = parsed.session.accessToken;
        memorySessionTouched = true;
        lastPublic = publicSessionView(parsed.session);
        return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() };
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
      return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() };
    }
    memoryAccessToken = token;
    lastPublic = Object.freeze({ signedIn: true, maskedAccount: "\u2022\u2022\u2022\u2022", authMode: "oidc", source: "dsh-credentials" });
    return { account: lastPublic, catalog, usage: lastUsage, cliAvailable: grokCliAvailable(), authPath: authJsonPath() };
  };
  const login = async (options) => {
    await spawnGrokLogin(options);
    return pull();
  };
  const logout = async () => {
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
    models: () => catalog.models,
    catalog: () => catalog,
    usage: () => lastUsage,
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
  "catalog/refresh",
  "usage",
  "usage/refresh"
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
    return out;
  }
  if (typeof usage.usedPercent === "number" && Number.isFinite(usage.usedPercent)) out.usedPercent = usage.usedPercent;
  if (typeof usage.remainingPercent === "number" && Number.isFinite(usage.remainingPercent)) out.remainingPercent = usage.remainingPercent;
  if (typeof usage.periodStart === "string") out.periodStart = usage.periodStart;
  if (typeof usage.periodStartLocal === "string") out.periodStartLocal = usage.periodStartLocal;
  if (typeof usage.periodEnd === "string") out.periodEnd = usage.periodEnd;
  if (typeof usage.periodEndLocal === "string") out.periodEndLocal = usage.periodEndLocal;
  if (typeof usage.fetchedAt === "string") out.fetchedAt = usage.fetchedAt;
  if (Array.isArray(usage.productUsage)) {
    out.productUsage = usage.productUsage.filter((row) => row && typeof row === "object").map((row) => ({
      ...typeof row.name === "string" ? { name: row.name } : {},
      ...typeof row.usedPercent === "number" && Number.isFinite(row.usedPercent) ? { usedPercent: row.usedPercent } : {}
    }));
  }
  return out;
}
async function dispatch(session, endpoint) {
  if (endpoint === "status") return publicResult(stripSecrets(await session.status()));
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
  return publicError(new Error(`Unknown Grok subscription RPC: ${endpoint}`));
}
function createRpcHandler(session, options = {}) {
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : RPC_HANDLER_TIMEOUT_MS;
  return async function handle(endpoint, _payload, _signal) {
    try {
      return await withTimeout(
        dispatch(session, endpoint),
        timeoutMs,
        `Grok subscription RPC "${endpoint}" timed out after ${timeoutMs}ms`,
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
  const handler = createRpcHandler(session);
  const createSync = options.createSync ?? createGrokBuildAdapterSync;
  try {
    const created = createSync(session);
    if (created.note) ctx.logger?.debug?.(created.note);
    ctx.llm.registerAdapter([PROVIDER_ID], created.adapter);
    notifyCatalogChange();
  } catch (error) {
    ctx.logger?.warn?.(
      "Grok subscription duck adapter failed to register: %s",
      error instanceof Error ? error.message : "unknown"
    );
  }
  const defer = options.defer ?? scheduleDeferred2;
  defer(() => {
    void deferredBoot(ctx, session, notifyCatalogChange, options);
  });
  ctx.inject(["connection"], (connectionContext) => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    "grok-subscription: host-only account RPC"
  ));
}
async function deferredBoot(ctx, session, notifyCatalogChange, options = {}) {
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
  if (options.skipUpgrade) return;
  const createAsync = options.createAsync ?? createGrokBuildAdapter;
  try {
    const created = await createAsync(session);
    if (created.kind === "pi-ai") {
      if (created.note) ctx.logger?.warn?.(created.note);
      ctx.llm.registerAdapter([PROVIDER_ID], created.adapter);
      notifyCatalogChange?.();
    } else if (created.note) {
      ctx.logger?.debug?.(created.note);
    }
  } catch (error) {
    ctx.logger?.warn?.(
      "Grok subscription adapter upgrade failed: %s",
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
