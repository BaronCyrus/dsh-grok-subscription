window.__ModuleLoader__.load({ id: "dsh-grok-subscription", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  GrokSubscriptionSection: () => GrokSubscriptionSection,
  RPC_CALL_TIMEOUT_MS: () => RPC_CALL_TIMEOUT_MS,
  apply: () => apply,
  callRpc: () => callRpc,
  inject: () => inject,
  pickCopy: () => pickCopy
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");

// src/locales.js
var zh = {
  nav: "Grok \u8BA2\u9605",
  title: "Grok \u8BA2\u9605",
  subtitle: "\u7528 SuperGrok / X Premium\uFF08Grok Build\uFF09\u4F1A\u8BDD\uFF0C\u800C\u4E0D\u662F XAI_API_KEY\u3002",
  signedIn: "\u5DF2\u767B\u5F55",
  signedOut: "\u672A\u767B\u5F55",
  account: "\u8D26\u6237",
  unknownAccount: "\u5DF2\u4FDD\u5B58\u4F1A\u8BDD\uFF08\u8D26\u6237\u5DF2\u8131\u654F\uFF09",
  models: "\u53EF\u7528\u6A21\u578B",
  noModels: "\u672A\u767B\u5F55\u65F6\u4E0D\u66B4\u9732\u4EFB\u4F55\u6A21\u578B\u3002",
  catalogSourceLive: "\u6765\u6E90\uFF1A\u5B9E\u65F6 models-v2",
  catalogSourceFallback: "\u6765\u6E90\uFF1A\u9759\u6001\u56DE\u9000\u76EE\u5F55\uFF08\u542B grok-4.7\uFF09",
  catalogSourceSignedOut: "\u767B\u5F55\u540E\u624D\u4F1A\u5217\u51FA\u6A21\u578B\u3002",
  catalogError: "\u76EE\u5F55\u9519\u8BEF",
  loginCli: "CLI \u767B\u5F55",
  loginDevice: "\u8BBE\u5907\u7801\u767B\u5F55",
  pull: "\u4ECE Grok CLI \u62C9\u53D6",
  logout: "\u9000\u51FA\u767B\u5F55",
  loginHint: "\u4F1A\u5728\u542F\u52A8 DSH \u7684\u7EC8\u7AEF\u4E2D\u8FD0\u884C grok login\u3002\u8BF7\u5728\u7EC8\u7AEF\u6216\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210\u6388\u6743\uFF0C\u7136\u540E\u7B49\u5F85\u540C\u6B65\u3002",
  deviceHint: "\u8BBE\u5907\u7801\u63D0\u793A\u4F1A\u51FA\u73B0\u5728 DSH \u7EC8\u7AEF\u3002\u4E5F\u53EF\u624B\u52A8\u8FD0\u884C grok login --device-auth\uFF0C\u5B8C\u6210\u540E\u70B9\u201C\u4ECE Grok CLI \u62C9\u53D6\u201D\u3002",
  pullHint: "\u5B89\u5168\u8BFB\u53D6 ~/.grok/auth.json\uFF08\u62D2\u7EDD\u7B26\u53F7\u94FE\u63A5\u4E0E\u7EC4/\u5176\u4ED6\u4EBA\u53EF\u8BFB\uFF09\uFF0C\u53EA\u628A\u77ED\u671F access token \u5199\u5165 DSH\u3002",
  busy: "\u5904\u7406\u4E2D\u2026",
  busyCatalog: "\u6B63\u5728\u5237\u65B0\u6A21\u578B\u76EE\u5F55\u2026",
  busyUsage: "\u6B63\u5728\u5237\u65B0\u7528\u91CF\u2026",
  error: "\u64CD\u4F5C\u5931\u8D25",
  pullOk: "\u5DF2\u4ECE Grok CLI \u62C9\u53D6\u6210\u529F",
  loginOk: "\u767B\u5F55\u5B8C\u6210\uFF0C\u4F1A\u8BDD\u5DF2\u540C\u6B65",
  logoutOk: "\u5DF2\u9000\u51FA\u767B\u5F55",
  cliMissing: "\u672A\u53D1\u73B0 grok CLI\u3002\u8BF7\u5148\u5B89\u88C5\u5B98\u65B9 CLI \u5E76\u8FD0\u884C grok login\uFF0C\u7136\u540E\u62C9\u53D6\u3002",
  caveats: "\u793E\u533A\u63D2\u4EF6\uFF0C\u4E0D\u662F\u5B98\u65B9\u4EA7\u54C1\u3002\u8BA2\u9605\u7528\u4E8E\u975E\u5B98\u65B9\u5BA2\u6237\u7AEF\u53EF\u80FD\u5904\u4E8E\u4F9B\u5E94\u5546\u6761\u6B3E\u7070\u8272\u5730\u5E26\uFF1B\u53EA\u4F7F\u7528\u4F60\u81EA\u5DF1\u7684\u8D26\u53F7\u3002\u534F\u8BAE\u53EF\u80FD\u53D8\u5316\uFF0C\u56E0\u4E3A\u5B98\u65B9\u6587\u6863\u672A\u516C\u5F00\u5B8C\u6574 HTTP wire protocol\u3002",
  usageTitle: "\u7528\u91CF\uFF08\u5B9E\u9A8C\u6027\uFF09",
  usageSubtitle: "\u6765\u81EA\u672A\u6587\u6863\u5316\u7684\u8BA2\u9605 billing API\uFF08/v1/billing?format=credits\uFF09\uFF0C\u4EC5\u4F9B\u53C2\u8003\uFF0C\u53EF\u80FD\u968F\u65F6\u5931\u6548\u3002",
  usageUsed: "\u5DF2\u7528",
  usageRemaining: "\u5269\u4F59\u7EA6",
  usageReset: "\u5468\u671F\u7ED3\u675F / \u91CD\u7F6E",
  usageUnavailable: "\u4E0D\u53EF\u7528",
  usageRefresh: "\u5237\u65B0\u7528\u91CF",
  usageOpenGrok: "\u5728 grok.com \u67E5\u770B\u7528\u91CF",
  usageProduct: "\u4EA7\u54C1\u660E\u7EC6",
  usageFetchedAt: "\u6700\u8FD1\u5237\u65B0",
  usageRefreshOk: "\u7528\u91CF\u5DF2\u5237\u65B0",
  catalogRefreshOk: "\u6A21\u578B\u76EE\u5F55\u5DF2\u5237\u65B0"
};
var en = {
  nav: "Grok Subscription",
  title: "Grok Subscription",
  subtitle: "Use a SuperGrok / X Premium (Grok Build) session, not XAI_API_KEY.",
  signedIn: "Signed in",
  signedOut: "Signed out",
  account: "Account",
  unknownAccount: "Saved session (account masked)",
  models: "Available models",
  noModels: "No models are exposed until you sign in.",
  catalogSourceLive: "Source: live models-v2",
  catalogSourceFallback: "Source: static fallback catalog (includes grok-4.7)",
  catalogSourceSignedOut: "Models appear after sign-in.",
  catalogError: "Catalog error",
  loginCli: "CLI login",
  loginDevice: "Device-code login",
  pull: "Pull from Grok CLI",
  logout: "Log out",
  loginHint: "Runs grok login in the terminal that started DSH. Finish the browser or CLI prompt there, then wait for sync.",
  deviceHint: "The device-code prompt appears in the DSH terminal. You can also run grok login --device-auth yourself, then Pull from Grok CLI.",
  pullHint: "Reads ~/.grok/auth.json securely (refuses symlinks and group/other-readable files) and stores only the short-lived access token in DSH.",
  busy: "Working\u2026",
  busyCatalog: "Refreshing model catalog\u2026",
  busyUsage: "Refreshing usage\u2026",
  error: "Request failed",
  pullOk: "Pulled from Grok CLI successfully",
  loginOk: "Signed in and session synced",
  logoutOk: "Signed out",
  cliMissing: "The grok CLI was not found. Install it, run grok login, then pull.",
  caveats: "Community plugin, not an official product. Using a subscription from an unofficial client may be a vendor-ToS gray area; use your own account only. The protocol can change because official docs do not publish the full HTTP wire protocol.",
  usageTitle: "Usage (experimental)",
  usageSubtitle: "From the undocumented subscription billing API (/v1/billing?format=credits). Informational only; the endpoint may change or disappear.",
  usageUsed: "Used",
  usageRemaining: "Remaining \u2248",
  usageReset: "Period end / reset",
  usageUnavailable: "Unavailable",
  usageRefresh: "Refresh usage",
  usageOpenGrok: "View usage on grok.com",
  usageProduct: "Product breakdown",
  usageFetchedAt: "Last refreshed",
  usageRefreshOk: "Usage refreshed",
  catalogRefreshOk: "Model catalog refreshed"
};

// src/rpc-contract.js
var CHANNEL = "/grok-subscription";
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
function createRpcClient(transport) {
  return Object.freeze({
    call(channel, endpoint, payload, signal) {
      if (channel !== CHANNEL || !RPC_ENDPOINTS.includes(endpoint)) {
        throw new Error("Invalid Grok subscription RPC target");
      }
      return transport.call("/api", `grok-subscription/${endpoint}`, payload, signal);
    }
  });
}
function unwrap(response) {
  if (!response?.ok) throw new Error(response?.error?.message ?? "Grok subscription RPC failed");
  return response.value;
}

// src/constants.js
var LOCALE_NS = "settings.grokSubscription";
var USAGE_PAGE_URL = "https://grok.com/?_s=usage";
var SESSION_AUTH_MODES = Object.freeze(["oidc", "external", "web_login", "grok"]);
var API_KEY_AUTH_MODES = Object.freeze(["api_key"]);
var STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1e3;
var MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
var FALLBACK_MODEL_IDS = Object.freeze(["grok-4.7", "grok-4.6", "grok-4.5"]);

// src/client.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "locale", "connection", "settingsScope"];
var RPC_CALL_TIMEOUT_MS = 45e3;
function pickCopy(locale) {
  const language = typeof locale === "string" ? locale : locale?.language ?? locale?.lang;
  const resolved = language ?? (typeof navigator !== "undefined" ? navigator.language : "zh-CN");
  return String(resolved).toLowerCase().startsWith("zh") ? zh : en;
}
function sourceLabel(source, t) {
  if (source === "live") return t("catalogSourceLive");
  if (source === "fallback") return t("catalogSourceFallback");
  return t("catalogSourceSignedOut");
}
function formatPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return void 0;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
async function callRpc(rpc, endpoint, payload = {}) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : void 0;
  let timer;
  try {
    const call = rpc.call(CHANNEL, endpoint, payload, controller?.signal);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
        }
        reject(new Error(`Request timed out after ${RPC_CALL_TIMEOUT_MS}ms`));
      }, RPC_CALL_TIMEOUT_MS);
    });
    return unwrap(await Promise.race([call, timeout]));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function UsagePanel({ usage, t, usageBusy, onRefresh, signedIn }) {
  const ok = usage?.status === "ok";
  const used = ok ? formatPercent(usage.usedPercent) : void 0;
  const remaining = ok ? formatPercent(usage.remainingPercent) : void 0;
  const resetLabel = usage?.periodEndLocal || usage?.periodEnd;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "usageBlock", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t("usageTitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("usageSubtitle") }),
    ok && used !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        t("usageUsed"),
        ": ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
          used,
          "%"
        ] }),
        remaining !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          " \xB7 ",
          t("usageRemaining"),
          " ",
          remaining,
          "%"
        ] }) : null
      ] }),
      resetLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "muted", children: [
        t("usageReset"),
        ": ",
        resetLabel,
        usage.periodEnd && usage.periodEndLocal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          " (",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: usage.periodEnd }),
          ")"
        ] }) : null
      ] }) : null,
      Array.isArray(usage.productUsage) && usage.productUsage.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("usageProduct") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: usage.productUsage.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
          row.name ?? "\u2014",
          typeof row.usedPercent === "number" ? ` \xB7 ${formatPercent(row.usedPercent)}%` : ""
        ] }, `${row.name ?? "row"}-${index}`)) })
      ] }) : null,
      usage.fetchedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "muted", children: [
        t("usageFetchedAt"),
        ": ",
        usage.fetchedAt
      ] }) : null
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      t("usageUnavailable"),
      usage?.reason ? `: ${usage.reason}` : ""
    ] }),
    usageBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("busyUsage") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: Boolean(usageBusy) || !signedIn, onClick: onRefresh, children: t("usageRefresh") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: USAGE_PAGE_URL, target: "_blank", rel: "noreferrer", children: t("usageOpenGrok") })
    ] })
  ] });
}
function GrokSubscriptionSection({ rpc, t }) {
  const [busy, setBusy] = (0, import_react.useState)("");
  const [usageBusy, setUsageBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)("");
  const [status, setStatus] = (0, import_react.useState)(void 0);
  const initialUsageKick = (0, import_react.useRef)(false);
  const applyPartial = (value) => {
    if (value?.account || value?.catalog || value?.usage) {
      setStatus((current) => ({ ...current, ...value }));
    }
  };
  const load = async () => {
    const value = await callRpc(rpc, "status", {});
    setStatus(value);
    setError("");
    return value;
  };
  (0, import_react.useEffect)(() => {
    void load().then((value) => {
      if (initialUsageKick.current) return;
      if (value?.account?.signedIn !== true) return;
      initialUsageKick.current = true;
      void callRpc(rpc, "usage/refresh", {}).then((partial) => {
        applyPartial(partial);
      }).catch(() => {
      });
    }).catch((item) => {
      setNotice("");
      setError(item instanceof Error ? item.message : String(item));
    });
  }, [rpc]);
  const kickFollowUpRefresh = () => {
    void callRpc(rpc, "catalog/refresh", {}).then((partial) => {
      applyPartial(partial);
    }).catch(() => {
    });
    void callRpc(rpc, "usage/refresh", {}).then((partial) => {
      applyPartial(partial);
    }).catch(() => {
    });
  };
  const run = async (endpoint) => {
    const isUsageRefresh = endpoint === "usage/refresh";
    if (isUsageRefresh) {
      setUsageBusy(true);
    } else {
      setBusy(endpoint);
    }
    setError("");
    setNotice("");
    let value;
    try {
      value = await callRpc(rpc, endpoint, {});
      if (value?.account || value?.catalog || value?.usage) {
        applyPartial(value);
      } else {
        await load();
      }
      if (value?.ok === false && value.error) {
        setNotice("");
        setError(value.error);
      } else if (value?.ok !== false) {
        const successKey = {
          pull: "pullOk",
          "login/cli": "loginOk",
          "login/device": "loginOk",
          logout: "logoutOk",
          "usage/refresh": "usageRefreshOk"
        }[endpoint];
        if (successKey) setNotice(t(successKey));
      }
    } catch (item) {
      setNotice("");
      setError(item instanceof Error ? item.message : String(item));
    } finally {
      if (isUsageRefresh) setUsageBusy(false);
      else setBusy("");
    }
    const shouldFollowUp = (endpoint === "pull" || endpoint === "login/cli" || endpoint === "login/device") && value?.ok !== false && !value?.error;
    if (shouldFollowUp) kickFollowUpRefresh();
  };
  const account = status?.account;
  const catalog = status?.catalog;
  const models = catalog?.models ?? [];
  const signedIn = account?.signedIn === true;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "grokSubscription", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        .grokSubscription { display: grid; gap: 12px; max-width: 42rem; }
        .grokSubscription h2 { margin: 0 0 4px; font-size: 1.15rem; }
        .grokSubscription p, .grokSubscription li { line-height: 1.5; }
        .grokSubscription .muted { opacity: 0.78; font-size: 0.92rem; }
        .grokSubscription .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .grokSubscription button { cursor: pointer; }
        .grokSubscription .error { color: #b42318; }
        .grokSubscription .notice { color: #067647; }
        .grokSubscription ul { margin: 0; padding-left: 1.2rem; }
        .grokSubscription .usageBlock { display: grid; gap: 8px; padding: 10px 0; border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
        .grokSubscription a { color: inherit; }
      ` }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("subtitle") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
        t("account"),
        ": "
      ] }),
      signedIn ? `${t("signedIn")} \xB7 ${account.maskedAccount ?? t("unknownAccount")}` : t("signedOut")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: Boolean(busy), onClick: () => void run("login/cli"), children: t("loginCli") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: Boolean(busy), onClick: () => void run("login/device"), children: t("loginDevice") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: Boolean(busy), onClick: () => void run("pull"), children: t("pull") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: Boolean(busy) || !signedIn, onClick: () => void run("logout"), children: t("logout") })
    ] }),
    busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("busy") }) : null,
    notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "notice", children: notice }) : null,
    error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "error", children: [
      t("error"),
      ": ",
      error
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("loginHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("deviceHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("pullHint") }),
    status?.cliAvailable === false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("cliMissing") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      UsagePanel,
      {
        usage: status?.usage,
        t,
        usageBusy,
        signedIn,
        onRefresh: () => void run("usage/refresh")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t("models") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: sourceLabel(catalog?.source, t) }),
      models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("noModels") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
        model.name,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: model.id })
      ] }, model.id)) }),
      catalog?.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "error", children: [
        t("catalogError"),
        ": ",
        catalog.error
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "muted", children: t("caveats") })
  ] });
}
function apply(ctx) {
  ctx.effect?.(() => ctx.locale?.register?.(LOCALE_NS, { zh, en }), "grok-subscription: copy");
  const connection = ctx.get?.("connection") ?? ctx.connection;
  const rpc = createRpcClient(connection.rpc);
  const bound = ctx.locale?.bind?.(LOCALE_NS);
  const t = (key) => {
    try {
      const value = bound?.(key);
      if (typeof value === "string" && value && value !== key) return value;
    } catch {
    }
    return pickCopy(ctx.locale)[key] ?? key;
  };
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "grok-subscription",
    order: 16,
    label: () => t("nav"),
    locale: LOCALE_NS,
    inject: () => ({ rpc, t })
  }, GrokSubscriptionSection));
}
return module.exports; } });
