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
  GrokSubscriptionPanel: () => GrokSubscriptionPanel,
  GrokSubscriptionSection: () => GrokSubscriptionSection,
  RPC_CALL_TIMEOUT_MS: () => RPC_CALL_TIMEOUT_MS,
  SectionBoundary: () => SectionBoundary,
  UsagePanel: () => UsagePanel,
  apply: () => apply,
  callRpc: () => callRpc,
  inject: () => inject,
  pickCopy: () => pickCopy
});
module.exports = __toCommonJS(client_exports);
var import_react2 = require("react");

// src/locales.js
var zh = {
  nav: "Grok \u8BA2\u9605",
  title: "Grok \u8BA2\u9605",
  subtitle: "\u7528 SuperGrok / X Premium\uFF08Grok Build\uFF09\u4F1A\u8BDD\uFF0C\u800C\u4E0D\u662F XAI_API_KEY\u3002\xB7 1.0.5",
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
  loginHelp: "\u767B\u5F55\u65B9\u5F0F\u8BF4\u660E",
  refreshCatalog: "\u5237\u65B0\u6A21\u578B\u76EE\u5F55",
  renderError: "\u754C\u9762\u6E32\u67D3\u5931\u8D25",
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
  catalogRefreshOk: "\u6A21\u578B\u76EE\u5F55\u5DF2\u5237\u65B0",
  composerQuotaDetails: "\u6BCF\u5468\u989D\u5EA6",
  composerQuotaRemaining: "\u6BCF\u5468\u989D\u5EA6 \u5269\u4F59 {remaining}%",
  composerQuotaResets: "\u91CD\u7F6E\u4E8E {reset}",
  composerQuotaResetUnknown: "\u91CD\u7F6E\u65F6\u95F4\u672A\u77E5"
};
var en = {
  nav: "Grok Subscription",
  title: "Grok Subscription",
  subtitle: "Use a SuperGrok / X Premium (Grok Build) session, not XAI_API_KEY. \xB7 1.0.5",
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
  loginHelp: "How signing in works",
  refreshCatalog: "Refresh model catalog",
  renderError: "Failed to render this panel",
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
  catalogRefreshOk: "Model catalog refreshed",
  composerQuotaDetails: "Weekly quota",
  composerQuotaRemaining: "Weekly quota \xB7 {remaining}% left",
  composerQuotaResets: "Resets {reset}",
  composerQuotaResetUnknown: "Reset time unknown"
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
var PROVIDER_ID = "grok-build";
var LOCALE_NS = "settings.grokSubscription";
var USAGE_PAGE_URL = "https://grok.com/?_s=usage";
var SESSION_AUTH_MODES = Object.freeze(["oidc", "external", "web_login", "grok"]);
var API_KEY_AUTH_MODES = Object.freeze(["api_key"]);
var STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1e3;
var MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
var FALLBACK_MODEL_IDS = Object.freeze(["grok-4.7", "grok-4.6", "grok-4.5"]);

// src/client-settings-style.js
var SETTINGS_STYLE = `
.grokSubscription{display:flex;flex-direction:column;gap:10px;max-width:720px;color:var(--dsw-alias-label-primary);container-type:inline-size}
.grokSubscription h2,.grokSubscription h3,.grokSubscription p{margin:0}
.grokSubscription h2{font-size:16px;line-height:24px;font-weight:500}
.grokSubscription h3{font-size:15px;line-height:22px;font-weight:600}

.gsHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gsLead{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}

.gsCard{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.gsCardHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.gsCardHead .gsSpacer{flex:1;min-width:0}

.gsChip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.gsChip--ok{color:var(--dsw-alias-state-success-primary)}
.gsChip--off{color:var(--dsw-alias-label-tertiary)}
.gsChip--warn{color:var(--dsw-alias-state-warn-label)}
.gsChip--error{color:var(--dsw-alias-label-error)}
.gsDot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}

.gsAccount{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}

.gsActions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gsBtn{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:0 0;transition:background .16s,border-color .16s,color .16s}
.gsBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.gsBtn:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px}
.gsBtn:disabled{opacity:.45;cursor:not-allowed}
.gsBtn--primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}
.gsBtn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.gsBtn--danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-label-error);border-color:var(--dsw-alias-label-error)}

.gsStatus{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.gsStatus--ok{color:var(--dsw-alias-state-success-primary)}
.gsStatus--error{color:var(--dsw-alias-label-error)}
.gsStatus--warn{color:var(--dsw-alias-state-warn-label)}
.gsStatus--busy{color:var(--dsw-alias-label-tertiary)}

.gsDisclosure{margin:0}
.gsDisclosure>summary{display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer;list-style:none;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.gsDisclosure>summary::-webkit-details-marker{display:none}
.gsDisclosure>summary:hover{color:var(--dsw-alias-label-primary)}
.gsDisclosure>summary:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:4px;border-radius:4px}
.gsChevron{flex:none;transition:transform .16s}
.gsDisclosure[open] .gsChevron{transform:rotate(180deg)}
.gsDisclosureBody{display:flex;flex-direction:column;gap:6px;padding-top:8px;margin-top:8px;border-top:.5px solid var(--dsw-alias-border-l2)}
.gsDisclosureBody p{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}

.gsGauge{display:flex;flex-direction:column;gap:8px}
.gsGaugeTop{display:flex;align-items:baseline;gap:8px}
.gsGaugeValue{font-size:24px;line-height:30px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.gsGaugeLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.gsBar{height:6px;border-radius:999px;background:color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);overflow:hidden}
.gsBar>span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .2s}
.gsGaugeMeta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.gsGaugeMeta code{font-size:11px;color:var(--dsw-alias-label-tertiary)}

.gsRows{display:flex;flex-direction:column;gap:0}
.gsRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px;line-height:20px;border-top:.5px solid var(--dsw-alias-border-l2)}
.gsRow:first-child{border-top:none}
.gsRowValue{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}

.gsModels{display:flex;flex-wrap:wrap;gap:6px}
.gsModel{display:inline-flex;align-items:baseline;gap:6px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:4px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}
.gsModel code{font-size:11px;color:var(--dsw-alias-label-tertiary)}

.gsHint,.gsEmpty,.gsCaveat{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.gsCaveat{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.gsLink{color:var(--dsw-alias-link);font-size:13px;line-height:20px;text-decoration:none;align-self:center}
.gsLink:hover{text-decoration:underline}

@container (max-width: 420px){
  .grokSubscription .gsGaugeValue{font-size:20px;line-height:26px}
  .grokSubscription .gsBtn{flex:1 1 auto}
}
`;

// src/client-composer-quota.jsx
var import_react = require("react");
var import_react_dom = require("react-dom");

// src/client-composer-quota-shared.js
var QUICK_QUOTA_REFRESH_EVENT = "dsh-grok-subscription:refresh-quick-quota";
var QUICK_QUOTA_REFRESH_MS = 6e4;
var COMPOSER_QUOTA_STYLE = `
.grokComposerQuota:focus-visible{outline:1px solid var(--dsw-alias-border-l3);outline-offset:2px}
.grokComposerQuota{display:inline-flex;align-items:center;gap:9px;flex:0 0 auto;height:28px;box-sizing:border-box;padding:0 5px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.grokComposerQuota:hover,.grokComposerQuota[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}
.grokQuotaPopover{position:fixed;z-index:1000;width:max-content;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 4px 16px #0002;font-size:12px;line-height:20px;outline:none}
.grokQuotaDetail>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.grokQuotaDetail strong{font-weight:500}
.grokQuotaReset{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}
`;
function fillTemplate(text, values) {
  return Object.entries(values).reduce(
    (next, [key, value]) => next.replaceAll(`{${key}}`, String(value)),
    String(text ?? "")
  );
}
function formatRemainingPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return void 0;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
function formatShortReset(usage) {
  if (!usage || typeof usage !== "object") return void 0;
  const iso = typeof usage.periodEnd === "string" ? usage.periodEnd : void 0;
  if (iso) {
    const ms = Date.parse(iso);
    if (Number.isFinite(ms)) {
      return new Date(ms).toLocaleString(void 0, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }
  const local = typeof usage.periodEndLocal === "string" ? usage.periodEndLocal.trim() : "";
  if (!local) return void 0;
  const match = local.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (match) {
    return `${Number(match[2])}/${Number(match[3])} ${match[4]}:${match[5]}`;
  }
  return local;
}
function isComposerQuotaEnabled(provider, usage) {
  if (provider !== PROVIDER_ID) return false;
  if (!usage || usage.status !== "ok") return false;
  return typeof usage.remainingPercent === "number" && Number.isFinite(usage.remainingPercent);
}
function notifyQuickQuota() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(QUICK_QUOTA_REFRESH_EVENT));
    }
  } catch {
  }
}

// src/client-composer-quota.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var QUICK_RPC_TIMEOUT_MS = 12e3;
async function quickCall(rpc, endpoint) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : void 0;
  let timer;
  try {
    const call = rpc.call(CHANNEL, endpoint, {}, controller?.signal);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
        }
        reject(new Error(`Request timed out after ${QUICK_RPC_TIMEOUT_MS}ms`));
      }, QUICK_RPC_TIMEOUT_MS);
    });
    return unwrap(await Promise.race([call, timeout]));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function useAnchoredPositionFallback({ open, anchorRef }) {
  const [position, setPosition] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    if (!open || !anchorRef?.current) {
      setPosition(null);
      return void 0;
    }
    const place = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        position: "fixed",
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 12)),
        top: Math.max(12, rect.top - 8),
        transform: "translateY(-100%)"
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef]);
  return position;
}
function useDismissOnOutsidePointerFallback(triggerRef, open, dismiss, panelRef) {
  (0, import_react.useEffect)(() => {
    if (!open) return void 0;
    const onPointer = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains?.(target) || panelRef.current?.contains?.(target)) return;
      dismiss();
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open, triggerRef, panelRef, dismiss]);
}
function loadAnchoringHooks() {
  try {
    const req = typeof require === "function" ? require : void 0;
    const mod = req?.("@deepseek-ai/dsh-client-ui-primitives");
    if (mod?.useAnchoredPosition && mod?.useDismissOnOutsidePointer) {
      return {
        useAnchoredPosition: mod.useAnchoredPosition,
        useDismissOnOutsidePointer: mod.useDismissOnOutsidePointer
      };
    }
  } catch {
  }
  return {
    useAnchoredPosition: useAnchoredPositionFallback,
    useDismissOnOutsidePointer: useDismissOnOutsidePointerFallback
  };
}
var anchoring = loadAnchoringHooks();
function useGrokQuickQuota(rpc, enabled) {
  const [usage, setUsage] = (0, import_react.useState)(void 0);
  (0, import_react.useEffect)(() => {
    if (!enabled) {
      setUsage(void 0);
      return void 0;
    }
    let live = true;
    let loading = false;
    const accept = (next) => {
      if (!live) return;
      if (next && next.status === "ok" && typeof next.remainingPercent === "number" && Number.isFinite(next.remainingPercent)) {
        setUsage(next);
      } else {
        setUsage(void 0);
      }
    };
    const softRefresh = () => {
      void quickCall(rpc, "usage/refresh").then((value) => {
        if (value?.usage) accept(value.usage);
      }).catch(() => {
      });
    };
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        let status;
        try {
          status = await quickCall(rpc, "status");
        } catch {
          status = void 0;
        }
        if (!live) return;
        if (status?.account?.signedIn !== true) {
          try {
            const value = await quickCall(rpc, "usage");
            accept(value?.usage);
          } catch {
            accept(void 0);
          }
          return;
        }
        let next = status?.usage;
        if (!next || next.status !== "ok") {
          try {
            const value = await quickCall(rpc, "usage");
            next = value?.usage ?? next;
          } catch {
          }
        }
        if (!live) return;
        accept(next);
        softRefresh();
      } catch {
        if (live) setUsage(void 0);
      } finally {
        loading = false;
      }
    };
    const refresh = () => {
      void load();
    };
    void load();
    const timer = window.setInterval(refresh, QUICK_QUOTA_REFRESH_MS);
    window.addEventListener(QUICK_QUOTA_REFRESH_EVENT, refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener(QUICK_QUOTA_REFRESH_EVENT, refresh);
    };
  }, [rpc, enabled]);
  return usage;
}
function GrokComposerQuota({ rpc, t, directory }) {
  const modelState = (0, import_react.useSyncExternalStore)(
    (listener) => directory.subscribe(listener),
    () => directory.getSnapshot()
  );
  const current = modelState?.current;
  const provider = current?.provider;
  const providerEnabled = provider === PROVIDER_ID;
  const usage = useGrokQuickQuota(rpc, providerEnabled);
  const enabled = isComposerQuotaEnabled(provider, usage);
  const remaining = enabled ? formatRemainingPercent(usage.remainingPercent) : void 0;
  const [open, setOpen] = (0, import_react.useState)(false);
  const trigger = (0, import_react.useRef)(null);
  const panel = (0, import_react.useRef)(null);
  const pinned = (0, import_react.useRef)(false);
  const dismissTimer = (0, import_react.useRef)(null);
  const enter = () => {
    clearTimeout(dismissTimer.current);
    setOpen(true);
  };
  const leave = () => {
    if (!pinned.current) dismissTimer.current = setTimeout(() => setOpen(false), 150);
  };
  const dismiss = () => {
    pinned.current = false;
    setOpen(false);
  };
  (0, import_react.useEffect)(() => () => clearTimeout(dismissTimer.current), []);
  const id = (0, import_react.useId)();
  const visible = open && enabled && remaining !== void 0;
  const position = anchoring.useAnchoredPosition({
    open: visible,
    anchorRef: trigger,
    panelRef: panel,
    side: "top",
    gap: 8,
    margin: 12
  });
  anchoring.useDismissOnOutsidePointer(trigger, visible, dismiss, panel);
  (0, import_react.useEffect)(() => {
    setOpen(false);
  }, [current?.model, enabled]);
  (0, import_react.useEffect)(() => {
    if (!visible) return void 0;
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss();
      trigger.current?.focus?.();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [visible]);
  if (!enabled || remaining === void 0) return null;
  const reset = formatShortReset(usage);
  const remainingLine = fillTemplate(t("composerQuotaRemaining"), { remaining });
  const resetLine = reset ? fillTemplate(t("composerQuotaResets"), { reset }) : t("composerQuotaResetUnknown");
  const detailsLabel = `${remainingLine} ${resetLine}`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        ref: trigger,
        type: "button",
        className: "grokComposerQuota",
        title: detailsLabel,
        "aria-label": `${t("composerQuotaDetails")}: ${detailsLabel}`,
        "aria-haspopup": "dialog",
        "aria-expanded": visible,
        "aria-controls": visible ? id : void 0,
        onMouseEnter: enter,
        onMouseLeave: leave,
        onClick: () => {
          if (pinned.current) dismiss();
          else {
            pinned.current = true;
            setOpen(true);
            requestAnimationFrame(() => panel.current?.focus?.());
          }
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: `${remaining}%` })
      }
    ),
    visible ? (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "section",
        {
          ref: panel,
          id,
          role: "dialog",
          "aria-label": t("composerQuotaDetails"),
          className: "grokQuotaPopover",
          tabIndex: -1,
          onMouseEnter: enter,
          onMouseLeave: leave,
          style: { ...position || {}, visibility: position ? "visible" : "hidden" },
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grokQuotaDetail", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: remainingLine }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "grokQuotaReset", children: resetLine })
          ] }) })
        }
      ),
      document.body
    ) : null
  ] });
}

// src/client.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = [
  "slots",
  "locale",
  "connection",
  "settingsScope",
  "modelDirectories",
  "sessions",
  "remote"
];
var RPC_CALL_TIMEOUT_MS = 12e3;
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
var SectionBoundary = class extends import_react2.Component {
  constructor(props) {
    super(props);
    this.state = { error: void 0 };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const t = this.props.t;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "grokSubscription", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: SETTINGS_STYLE }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsHead", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("title") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsCard", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsStatus gsStatus--error", children: [
        t("renderError"),
        ": ",
        error instanceof Error ? error.message : String(error)
      ] }) })
    ] });
  }
};
function GrokSubscriptionPanel(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SectionBoundary, { t: props.t, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GrokSubscriptionSection, { ...props }) });
}
function Chevron() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { className: "gsChevron", width: "12", height: "12", viewBox: "0 0 16 16", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 6l4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
function Chip({ tone = "off", children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: `gsChip gsChip--${tone}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsDot" }),
    children
  ] });
}
function UsagePanel({ usage, t, usageBusy, onRefresh, signedIn }) {
  const ok = usage?.status === "ok";
  const usedNumber = ok && Number.isFinite(usage.usedPercent) ? usage.usedPercent : void 0;
  const remainingNumber = ok && Number.isFinite(usage.remainingPercent) ? usage.remainingPercent : void 0;
  const used = usedNumber !== void 0 ? formatPercent(usedNumber) : void 0;
  const remaining = remainingNumber !== void 0 ? formatPercent(remainingNumber) : void 0;
  const resetLabel = usage?.periodEndLocal || usage?.periodEnd;
  const gaugeNumber = remainingNumber ?? (usedNumber !== void 0 ? 100 - usedNumber : void 0);
  const gaugeValue = gaugeNumber !== void 0 ? formatPercent(gaugeNumber) : void 0;
  const gaugeLabel = remainingNumber !== void 0 ? t("usageRemaining") : t("usageUsed");
  const fill = gaugeNumber === void 0 ? 0 : Math.min(100, Math.max(0, gaugeNumber));
  const products = Array.isArray(usage?.productUsage) ? usage.productUsage : [];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCard", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsCardHead", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: t("usageTitle") }) }),
    ok && (used !== void 0 || remaining !== void 0) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsGauge", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsGaugeTop", children: [
        gaugeValue !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "gsGaugeValue", children: [
          gaugeValue,
          "%"
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsGaugeLabel", children: gaugeLabel })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsBar", role: "img", "aria-label": `${gaugeLabel} ${gaugeValue ?? 0}%`, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { width: `${fill}%` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsGaugeMeta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          t("usageUsed"),
          " ",
          used ?? "\u2014",
          "%"
        ] }),
        resetLabel ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          t("usageReset"),
          " ",
          resetLabel
        ] }) : null,
        usage.periodEnd && usage.periodEndLocal ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: usage.periodEnd }) : null
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsEmpty", children: [
      t("usageUnavailable"),
      usage?.reason ? `: ${usage.reason}` : ""
    ] }),
    products.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsRows", children: products.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: row.name ?? "\u2014" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsRowValue", children: typeof row.usedPercent === "number" ? `${formatPercent(row.usedPercent)}%` : "\u2014" })
    ] }, `${row.name ?? "row"}-${index}`)) }) : null,
    usage?.fetchedAt ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsHint", children: [
      t("usageFetchedAt"),
      ": ",
      usage.fetchedAt
    ] }) : null,
    usageBusy ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--busy", children: t("busyUsage") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("usageSubtitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsActions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", disabled: Boolean(usageBusy) || !signedIn, onClick: onRefresh, children: t("usageRefresh") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { className: "gsLink", href: USAGE_PAGE_URL, target: "_blank", rel: "noreferrer", children: t("usageOpenGrok") })
    ] })
  ] });
}
function GrokSubscriptionSection({ rpc, t }) {
  const [busy, setBusy] = (0, import_react2.useState)("");
  const [usageBusy, setUsageBusy] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)("");
  const [notice, setNotice] = (0, import_react2.useState)("");
  const [status, setStatus] = (0, import_react2.useState)(void 0);
  const initialUsageKick = (0, import_react2.useRef)(false);
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
  (0, import_react2.useEffect)(() => {
    void load().then((value) => {
      if (initialUsageKick.current) return;
      if (value?.account?.signedIn !== true) return;
      initialUsageKick.current = true;
      void callRpc(rpc, "usage/refresh", {}).then((partial) => {
        applyPartial(partial);
        notifyQuickQuota();
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
      notifyQuickQuota();
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
          "usage/refresh": "usageRefreshOk",
          "catalog/refresh": "catalogRefreshOk"
        }[endpoint];
        if (successKey) setNotice(t(successKey));
        if (endpoint === "usage/refresh" && value?.ok !== false && !value?.error) {
          notifyQuickQuota();
        }
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "grokSubscription", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: SETTINGS_STYLE }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsHead", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Chip, { tone: signedIn ? "ok" : "off", children: signedIn ? t("signedIn") : t("signedOut") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsLead", children: t("subtitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCard", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCardHead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: t("account") }),
        signedIn && account?.maskedAccount ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsAccount", children: account.maskedAccount }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn gsBtn--primary", type: "button", disabled: Boolean(busy), onClick: () => void run("login/cli"), children: t("loginCli") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", disabled: Boolean(busy), onClick: () => void run("login/device"), children: t("loginDevice") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", disabled: Boolean(busy), onClick: () => void run("pull"), children: t("pull") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn gsBtn--danger", type: "button", disabled: Boolean(busy) || !signedIn, onClick: () => void run("logout"), children: t("logout") })
      ] }),
      busy ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--busy", children: t("busy") }) : null,
      notice ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--ok", children: notice }) : null,
      error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsStatus gsStatus--error", children: [
        t("error"),
        ": ",
        error
      ] }) : null,
      status?.cliAvailable === false ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--warn", children: t("cliMissing") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { className: "gsDisclosure", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("summary", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Chevron, {}),
          t("loginHelp")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsDisclosureBody", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("loginHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("deviceHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("pullHint") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      UsagePanel,
      {
        usage: status?.usage,
        t,
        usageBusy,
        signedIn,
        onRefresh: () => void run("usage/refresh")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCard", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCardHead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: t("models") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsSpacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Chip, { tone: catalog?.source === "live" ? "ok" : catalog?.source === "fallback" ? "warn" : "off", children: sourceLabel(catalog?.source, t) })
      ] }),
      models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsEmpty", children: t("noModels") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsModels", children: models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "gsModel", children: [
        model.name,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: model.id })
      ] }, model.id)) }),
      catalog?.error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsStatus gsStatus--error", children: [
        t("catalogError"),
        ": ",
        catalog.error
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsActions", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", disabled: !signedIn, onClick: () => void run("catalog/refresh"), children: t("refreshCatalog") }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsCaveat", children: t("caveats") })
  ] });
}
function apply(ctx) {
  ctx.effect?.(() => ctx.locale?.register?.(LOCALE_NS, { zh, en }), "grok-subscription: copy");
  let connection;
  try {
    connection = typeof ctx.get === "function" ? ctx.get("connection") : void 0;
  } catch {
    connection = void 0;
  }
  if (!connection) connection = ctx.connection;
  if (!connection?.rpc) {
    try {
      ctx.logger?.warn?.("Grok subscription Settings section skipped: connection unavailable");
    } catch {
    }
    return;
  }
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
  ctx.effect?.(() => {
    if (typeof document === "undefined") return void 0;
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-grok-subscription";
    tag.textContent = COMPOSER_QUOTA_STYLE;
    document.head.append(tag);
    return () => tag.remove();
  }, "grok-subscription: composer-quota-style");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "grok-subscription",
    order: 16,
    label: () => t("nav"),
    locale: LOCALE_NS,
    inject: () => ({ rpc, t })
  }, GrokSubscriptionPanel));
  const installDirectorySlots = (scope) => {
    let modelDirectories;
    try {
      modelDirectories = typeof scope.get === "function" ? scope.get("modelDirectories") : void 0;
    } catch {
      modelDirectories = void 0;
    }
    if (!modelDirectories?.directoryFor) {
      try {
        ctx.logger?.warn?.("Grok composer quota skipped: modelDirectories unavailable");
      } catch {
      }
      return;
    }
    scope.slots.inject("conversation.input.right", () => scope.slots.register({
      name: "conversation.input.right",
      id: "grok-subscription-quota",
      order: 16,
      locale: LOCALE_NS,
      inject: (sessionId) => ({
        rpc,
        t,
        directory: modelDirectories.directoryFor(sessionId).store
      })
    }, GrokComposerQuota));
  };
  try {
    const remoteSession = typeof ctx.get === "function" ? ctx.get("remote.session") : void 0;
    if (remoteSession === void 0) installDirectorySlots(ctx);
    else ctx.inject(["remote.session"], installDirectorySlots);
  } catch {
    installDirectorySlots(ctx);
  }
}
return module.exports; } });
