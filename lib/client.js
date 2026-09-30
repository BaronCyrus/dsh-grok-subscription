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
  DiagnosticsRows: () => DiagnosticsRows,
  GrokSubscriptionPanel: () => GrokSubscriptionPanel,
  GrokSubscriptionSection: () => GrokSubscriptionSection,
  RPC_CALL_TIMEOUT_MS: () => RPC_CALL_TIMEOUT_MS,
  SectionBoundary: () => SectionBoundary,
  UsagePanel: () => UsagePanel,
  VersionCard: () => VersionCard,
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
  subtitle: "\u7528 SuperGrok / X Premium\uFF08Grok Build\uFF09\u4F1A\u8BDD\uFF0C\u800C\u4E0D\u662F XAI_API_KEY\u3002\xB7 2.0.4",
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
  loginCli: "\u767B\u5F55",
  pull: "\u8BFB\u53D6\u5DF2\u4FDD\u5B58\u7684\u4F1A\u8BDD",
  logout: "\u9000\u51FA\u767B\u5F55",
  loginHint: "\u5728\u672C\u673A\u5411 auth.x.ai \u7533\u8BF7\u8BBE\u5907\u7801\uFF0C\u628A\u767B\u5F55\u94FE\u63A5\u4EA4\u7ED9\u6D4F\u89C8\u5668\u3002\u6388\u6743\u5B8C\u6210\u540E\u8FD9\u91CC\u4F1A\u81EA\u52A8\u540C\u6B65\uFF0C\u4E0D\u9700\u8981\u5B89\u88C5 grok \u547D\u4EE4\u3002",
  deviceHint: "\u9762\u677F\u4F1A\u663E\u793A\u4E00\u6B21\u6027\u9A8C\u8BC1\u7801\u3002\u82E5\u6D4F\u89C8\u5668\u6CA1\u6709\u81EA\u52A8\u6253\u5F00\uFF0C\u70B9\u63D0\u793A\u91CC\u7684\u201C\u6253\u5F00\u767B\u5F55\u9875\u9762\u201D\uFF0C\u5E76\u5728\u9875\u9762\u4E0A\u786E\u8BA4\u540C\u4E00\u4E2A\u9A8C\u8BC1\u7801\u3002",
  loginWaiting: "\u7B49\u5F85\u6D4F\u89C8\u5668\u6388\u6743\u2026",
  loginOpenBrowser: "\u6253\u5F00\u767B\u5F55\u9875\u9762",
  loginNoUrl: "\u6CA1\u62FF\u5230\u767B\u5F55\u94FE\u63A5\uFF1A\u8BF7\u786E\u8BA4\u672C\u673A\u80FD\u8BBF\u95EE auth.x.ai\u3002\u684C\u9762\u7248\u9700\u8981\u4EE3\u7406\u65F6\uFF0C\u5728 ~/.dsh/.env \u8BBE\u7F6E https_proxy \u540E\u91CD\u542F\u3002",
  loginTimeout: "\u7B49\u5F85\u6388\u6743\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u3002",
  pullHint: "\u5B89\u5168\u8BFB\u53D6 ~/.grok/auth.json\uFF08\u62D2\u7EDD\u7B26\u53F7\u94FE\u63A5\u4E0E\u7EC4/\u5176\u4ED6\u4EBA\u53EF\u8BFB\uFF09\u3002\u63D2\u4EF6\u767B\u5F55\u548C\u7EED\u671F\u4E5F\u4F1A\u5199\u56DE\u8FD9\u4E2A\u6587\u4EF6\uFF1B\u53EA\u628A\u77ED\u671F access token \u5199\u5165 DSH\u3002",
  loginHelp: "\u767B\u5F55\u65B9\u5F0F\u8BF4\u660E",
  refreshCatalog: "\u5237\u65B0\u6A21\u578B\u76EE\u5F55",
  renderError: "\u754C\u9762\u6E32\u67D3\u5931\u8D25",
  diagnostics: "\u8FD0\u884C\u901A\u8DEF",
  adapterPiAi: "\u5B98\u65B9 pi-ai",
  adapterUnavailable: "\u4E0D\u53EF\u7528",
  adapterStarting: "\u542F\u52A8\u4E2D",
  imageInput: "\u56FE\u7247\u8F93\u5165",
  imageInputOn: "\u53EF\u7528",
  imageInputOff: "\u4E0D\u53EF\u7528\uFF08\u672A\u89E3\u6790\u5230\u5BBF\u4E3B\u9644\u4EF6\u670D\u52A1\uFF09",
  adapterHint: "\u82E5\u663E\u793A\u300C\u4E0D\u53EF\u7528\u300D\uFF0C\u8BF4\u660E\u5BBF\u4E3B\u7F3A\u5C11 pi-ai \u9002\u914D\u5668\uFF1B\u8BF7\u786E\u8BA4 DSH \u5B89\u88C5\u5B8C\u6574\u540E\u91CD\u542F\u3002",
  busy: "\u5904\u7406\u4E2D\u2026",
  busyCatalog: "\u6B63\u5728\u5237\u65B0\u6A21\u578B\u76EE\u5F55\u2026",
  busyUsage: "\u6B63\u5728\u5237\u65B0\u7528\u91CF\u2026",
  error: "\u64CD\u4F5C\u5931\u8D25",
  pullOk: "\u5DF2\u8BFB\u53D6\u4FDD\u5B58\u7684\u4F1A\u8BDD",
  loginOk: "\u767B\u5F55\u5B8C\u6210\uFF0C\u4F1A\u8BDD\u5DF2\u540C\u6B65",
  logoutOk: "\u5DF2\u9000\u51FA\u767B\u5F55",
  caveats: "\u793E\u533A\u63D2\u4EF6\uFF0C\u4E0D\u662F\u5B98\u65B9\u4EA7\u54C1\u3002\u8BA2\u9605\u7528\u4E8E\u975E\u5B98\u65B9\u5BA2\u6237\u7AEF\u53EF\u80FD\u5904\u4E8E\u4F9B\u5E94\u5546\u6761\u6B3E\u7070\u8272\u5730\u5E26\uFF1B\u53EA\u4F7F\u7528\u4F60\u81EA\u5DF1\u7684\u8D26\u53F7\u3002\u534F\u8BAE\u53EF\u80FD\u53D8\u5316\uFF0C\u56E0\u4E3A\u5B98\u65B9\u6587\u6863\u672A\u516C\u5F00\u5B8C\u6574 HTTP wire protocol\u3002",
  usageTitle: "\u7528\u91CF\uFF08\u5B9E\u9A8C\u6027\uFF09",
  usageSubtitle: "\u6765\u81EA\u672A\u6587\u6863\u5316\u7684\u8BA2\u9605 billing API\uFF08/v1/billing?format=credits\uFF09\uFF0C\u4EC5\u4F9B\u53C2\u8003\uFF0C\u53EF\u80FD\u968F\u65F6\u5931\u6548\u3002",
  usageUsed: "\u5DF2\u7528",
  usageRemaining: "\u5269\u4F59\u7EA6",
  usageReset: "\u5468\u671F\u7ED3\u675F / \u91CD\u7F6E",
  usageWindow: "\u672C\u671F\u7A97\u53E3",
  usageUnifiedBilling: "\u4E0A\u6E38\u672A\u8FD4\u56DE\u989D\u5EA6\u767E\u5206\u6BD4\uFF1A\u8BE5\u8D26\u53F7\u5DF2\u662F\u7EDF\u4E00\u8BA1\u8D39\u5F62\u6001\uFF08\u4EE5\u9884\u4ED8\u4F59\u989D\u4E0E\u6309\u91CF\u4E0A\u9650\u8BA1\u91CF\uFF09\uFF0C\u56E0\u6B64\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u5468\u989D\u5EA6\u8BFB\u6570\u3002",
  usageMissingPercent: "\u4E0A\u6E38\u672A\u8FD4\u56DE\u989D\u5EA6\u767E\u5206\u6BD4\uFF0C\u672C\u671F\u6682\u65E0\u53EF\u7528\u8BFB\u6570\u3002",
  usageOmittedZero: "\u63A5\u53E3\u7701\u7565\u4E86 0 \u503C\u767E\u5206\u6BD4\uFF0C\u56E0\u6B64\u663E\u793A\u4E3A\u5DF2\u7528 0%\u3001\u5269\u4F59 100%\u3002\u8FD9\u4E0D\u662F\u53E6\u62A5\u7684\u6570\u5B57\uFF1B\u7A97\u53E3\u5BF9\u4E0D\u4E0A\u5F53\u524D\u65F6\u95F4\u65F6\u4E0D\u4F1A\u8FD9\u6837\u663E\u793A\u3002",
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
  composerQuotaResetUnknown: "\u91CD\u7F6E\u65F6\u95F4\u672A\u77E5",
  versionTitle: "\u63D2\u4EF6\u7248\u672C",
  versionCurrent: "\u5F53\u524D\u7248\u672C",
  versionLatest: "\u6700\u65B0\u7248\u672C",
  versionCheck: "\u68C0\u67E5\u66F4\u65B0",
  versionChecking: "\u6B63\u5728\u68C0\u67E5\u66F4\u65B0\u2026",
  versionFailed: "\u65E0\u6CD5\u68C0\u67E5\u6700\u65B0\u7248\u672C\u3002",
  versionUpToDate: "\u5DF2\u662F\u6700\u65B0\u7248\u672C\u3002",
  versionAvailable: "\u53D1\u73B0\u65B0\u7248\u672C v{version}\u3002",
  versionLinked: "\u5F53\u524D\u4E3A\u672C\u5730\u5F00\u53D1\u5B89\u88C5\uFF0C\u8BF7\u5728\u63D2\u4EF6\u4ED3\u5E93\u62C9\u53D6\u6700\u65B0\u4EE3\u7801\u5E76\u91CD\u65B0\u6784\u5EFA\u3002",
  versionManual: "\u8BF7\u5728\u7EC8\u7AEF\u8FD0\u884C dsh plugin --profile web add dsh-grok-subscription@latest \u5B8C\u6210\u66F4\u65B0\u3002",
  versionUpdate: "\u66F4\u65B0\u63D2\u4EF6",
  versionUpdating: "\u6B63\u5728\u66F4\u65B0\u2026",
  versionUpdateFailed: "\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u6216\u5728\u7EC8\u7AEF\u624B\u52A8\u66F4\u65B0\u3002",
  versionUpdated: "\u5DF2\u66F4\u65B0\u5230 v{version}\u3002",
  versionUpdatedHint: "\u65B0\u7248\u672C\u9700\u8981\u91CD\u542F DSH \u670D\u52A1\u624D\u80FD\u5B8C\u5168\u751F\u6548\uFF1B\u4EC5\u5237\u65B0\u754C\u9762\u4E0D\u4F1A\u66F4\u65B0\u5BBF\u4E3B\u8FDB\u7A0B\u4E2D\u5DF2\u52A0\u8F7D\u7684\u63D2\u4EF6\u3002",
  versionRestart: "\u91CD\u542F DSH \u670D\u52A1",
  versionRestartHint: "\u63D2\u4EF6\u65E0\u6CD5\u5B89\u5168\u5730\u91CD\u542F\u5BBF\u4E3B\u8FDB\u7A0B\uFF1A\u8BF7\u5728\u8FD0\u884C DSH \u7684\u7EC8\u7AEF\u6309 Ctrl+C \u7ED3\u675F\u8FDB\u7A0B\uFF0C\u518D\u91CD\u65B0\u8FD0\u884C dsh web\u3002",
  versionRefresh: "\u5237\u65B0\u754C\u9762",
  versionLater: "\u7A0D\u540E"
};
var en = {
  nav: "Grok Subscription",
  title: "Grok Subscription",
  subtitle: "Use a SuperGrok / X Premium (Grok Build) session, not XAI_API_KEY. \xB7 2.0.4",
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
  loginCli: "Sign in",
  pull: "Read saved session",
  logout: "Log out",
  loginHint: "Requests a device code from auth.x.ai on this machine and hands the link to your browser. The panel syncs itself once you authorize. The grok command is not required.",
  deviceHint: "The panel shows a one-time code. If no browser opened, use \u201COpen the sign-in page\u201D in the status line and confirm that same code.",
  loginWaiting: "Waiting for browser authorization\u2026",
  loginOpenBrowser: "Open the sign-in page",
  loginNoUrl: "No sign-in link was returned: make sure this machine can reach auth.x.ai. If the desktop app needs a proxy, set https_proxy in ~/.dsh/.env and restart.",
  loginTimeout: "Timed out waiting for authorization; click sign-in again.",
  pullHint: "Reads ~/.grok/auth.json securely (refuses symlinks and group/other-readable files). Sign-in and renewal write this file too, and only the short-lived access token is stored in DSH.",
  loginHelp: "How signing in works",
  refreshCatalog: "Refresh model catalog",
  renderError: "Failed to render this panel",
  diagnostics: "Active path",
  adapterPiAi: "official pi-ai",
  adapterUnavailable: "unavailable",
  adapterStarting: "starting",
  imageInput: "Image input",
  imageInputOn: "available",
  imageInputOff: "unavailable (host attachment service not resolved)",
  adapterHint: 'If this says "unavailable", the host has no pi-ai adapter; check the DSH installation and restart.',
  busy: "Working\u2026",
  busyCatalog: "Refreshing model catalog\u2026",
  busyUsage: "Refreshing usage\u2026",
  error: "Request failed",
  pullOk: "Saved session loaded",
  loginOk: "Signed in and session synced",
  logoutOk: "Signed out",
  caveats: "Community plugin, not an official product. Using a subscription from an unofficial client may be a vendor-ToS gray area; use your own account only. The protocol can change because official docs do not publish the full HTTP wire protocol.",
  usageTitle: "Usage (experimental)",
  usageSubtitle: "From the undocumented subscription billing API (/v1/billing?format=credits). Informational only; the endpoint may change or disappear.",
  usageUsed: "Used",
  usageRemaining: "Remaining \u2248",
  usageReset: "Period end / reset",
  usageWindow: "Current window",
  usageUnifiedBilling: "The upstream API returned no credit percentage: this account is on unified billing (measured by prepaid balance and an on-demand cap), so there is no weekly credit reading to show.",
  usageMissingPercent: "The upstream API returned no credit percentage for this period.",
  usageOmittedZero: "The API omitted a zero percentage, so this shows 0% used and 100% remaining. It is not a separately reported number, and it is not shown unless the billing window contains the current time.",
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
  composerQuotaResetUnknown: "Reset time unknown",
  versionTitle: "Plugin version",
  versionCurrent: "Current version",
  versionLatest: "Latest version",
  versionCheck: "Check for updates",
  versionChecking: "Checking for updates\u2026",
  versionFailed: "Could not check the latest version.",
  versionUpToDate: "You are on the latest version.",
  versionAvailable: "A new version v{version} is available.",
  versionLinked: "Installed from a local checkout; pull and rebuild the plugin repository to update.",
  versionManual: "Run dsh plugin --profile web add dsh-grok-subscription@latest in a terminal to update.",
  versionUpdate: "Update plugin",
  versionUpdating: "Updating\u2026",
  versionUpdateFailed: "The update failed. Try again or update manually in a terminal.",
  versionUpdated: "Updated to v{version}.",
  versionUpdatedHint: "The new version takes full effect after a DSH restart; refreshing the page alone does not reload the plugin inside the host process.",
  versionRestart: "Restart DSH",
  versionRestartHint: "The plugin cannot safely restart its host process: press Ctrl+C in the terminal running DSH, then run dsh web again.",
  versionRefresh: "Refresh page",
  versionLater: "Later"
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
  "usage/refresh",
  "plugin/version",
  "plugin/update"
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
var IMAGE_INPUT_MODEL_IDS = Object.freeze([
  "grok-4.7",
  "grok-4.7-build-fast",
  "grok-4.6"
]);

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
  "modelDirectories",
  "sessions",
  "remote"
];
var RPC_CALL_TIMEOUT_MS = 12e3;
var LOGIN_CALL_TIMEOUT_MS = 3e4;
var LOGIN_POLL_INTERVAL_MS = 3e3;
var LOGIN_POLL_TIMEOUT_MS = 10 * 6e4;
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
async function callRpc(rpc, endpoint, payload = {}, timeoutMs = RPC_CALL_TIMEOUT_MS) {
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
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
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
var ADAPTER_LABELS = {
  "pi-ai": "adapterPiAi",
  unavailable: "adapterUnavailable",
  starting: "adapterStarting"
};
function DiagnosticsRows({ diagnostics, t }) {
  if (!diagnostics) return null;
  const adapterKey = ADAPTER_LABELS[diagnostics.adapter];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRows", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("diagnostics") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsRowValue", children: adapterKey ? t(adapterKey) : diagnostics.adapter })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("imageInput") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsRowValue", children: diagnostics.imageInput ? t("imageInputOn") : t("imageInputOff") })
    ] })
  ] });
}
function fillTemplate2(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template
  );
}
function VersionCard({ call, t }) {
  const [info, setInfo] = (0, import_react2.useState)();
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [error, setError] = (0, import_react2.useState)(false);
  const [updating, setUpdating] = (0, import_react2.useState)(false);
  const [updateFailed, setUpdateFailed] = (0, import_react2.useState)(false);
  const [updated, setUpdated] = (0, import_react2.useState)();
  const [restartHint, setRestartHint] = (0, import_react2.useState)(false);
  const generation = (0, import_react2.useRef)(0);
  const load = (force) => {
    const current = ++generation.current;
    setLoading(true);
    setError(false);
    void call("plugin/version", { force }).then((value) => {
      if (generation.current === current) setInfo(value);
    }).catch(() => {
      if (generation.current === current) setError(true);
    }).finally(() => {
      if (generation.current === current) setLoading(false);
    });
  };
  (0, import_react2.useEffect)(() => {
    load(false);
    return () => {
      generation.current += 1;
    };
  }, []);
  const update = () => {
    setUpdating(true);
    setUpdateFailed(false);
    void call("plugin/update").then((value) => {
      setUpdated(value);
      setRestartHint(false);
    }).catch(() => setUpdateFailed(true)).finally(() => setUpdating(false));
  };
  const installKind = info?.install?.kind;
  const showStatus = info !== void 0 && updated === void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCard", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsCardHead", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: t("versionTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gsSpacer" }),
      updated === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", disabled: loading || updating, onClick: () => load(true), children: loading ? t("versionChecking") : t("versionCheck") }) : null
    ] }),
    loading && info === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--busy", role: "status", children: t("versionChecking") }) : null,
    error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--error", role: "alert", children: t("versionFailed") }) : null,
    info !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRows", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("versionCurrent") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "gsRowValue", children: [
          "v",
          info.current
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("versionLatest") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "gsRowValue", children: [
          "v",
          info.latest
        ] })
      ] })
    ] }) : null,
    showStatus ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--ok", role: "status", children: info.updateAvailable ? fillTemplate2(t("versionAvailable"), { version: info.latest }) : t("versionUpToDate") }) : null,
    showStatus && info.updateAvailable && installKind === "npm" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gsActions", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn gsBtn--primary", type: "button", disabled: updating, onClick: update, children: updating ? t("versionUpdating") : t("versionUpdate") }) }) : null,
    showStatus && installKind === "link" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("versionLinked") }) : null,
    showStatus && info.updateAvailable && installKind === "unknown" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("versionManual") }) : null,
    updateFailed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--error", role: "alert", children: t("versionUpdateFailed") }) : null,
    updated !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--ok", children: fillTemplate2(t("versionUpdated"), { version: updated.version }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("versionUpdatedHint") }),
      restartHint ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("versionRestartHint") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", onClick: () => setRestartHint(true), children: t("versionRestart") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn gsBtn--primary", type: "button", onClick: () => window.location.reload(), children: t("versionRefresh") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", onClick: () => setUpdated(void 0), children: t("versionLater") })
      ] })
    ] }) : null
  ] });
}
var EXPLAINED_USAGE_CODES = /* @__PURE__ */ new Set(["unified-billing", "missing-percent"]);
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
      ] }),
      usage.percentSource === "omitted-zero" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("usageOmittedZero") }) : null
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gsEmpty", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: EXPLAINED_USAGE_CODES.has(usage?.code) ? t(usage.code === "unified-billing" ? "usageUnifiedBilling" : "usageMissingPercent") : `${t("usageUnavailable")}${usage?.reason ? `: ${usage.reason}` : ""}` }),
      usage?.periodStartLocal || usage?.periodEndLocal ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsHint", children: [
        t("usageWindow"),
        ": ",
        usage?.periodStartLocal ?? usage?.periodStart ?? "\u2014",
        " \u2192 ",
        usage?.periodEndLocal ?? usage?.periodEnd ?? "\u2014"
      ] }) : null,
      EXPLAINED_USAGE_CODES.has(usage?.code) && usage?.reason ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: usage.reason }) }) : null
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
  const [loginPending, setLoginPending] = (0, import_react2.useState)(void 0);
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
  (0, import_react2.useEffect)(() => {
    if (!loginPending) return void 0;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > LOGIN_POLL_TIMEOUT_MS) {
        setLoginPending(void 0);
        setError(t("loginTimeout"));
        return;
      }
      void callRpc(rpc, "status", {}).then((value) => {
        if (value?.account || value?.catalog || value?.usage) applyPartial(value);
        if (value?.account?.signedIn !== true) return;
        setLoginPending(void 0);
        setNotice(t("loginOk"));
        kickFollowUpRefresh();
      }).catch(() => {
      });
    }, LOGIN_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loginPending, rpc]);
  const run = async (endpoint) => {
    const isUsageRefresh = endpoint === "usage/refresh";
    const isLogin = endpoint === "login/cli" || endpoint === "login/device";
    if (isUsageRefresh) {
      setUsageBusy(true);
    } else {
      setBusy(endpoint);
    }
    setError("");
    setNotice("");
    let value;
    try {
      value = await callRpc(rpc, endpoint, {}, isLogin ? LOGIN_CALL_TIMEOUT_MS : RPC_CALL_TIMEOUT_MS);
      if (value?.account || value?.catalog || value?.usage) {
        applyPartial(value);
      } else {
        await load();
      }
      if (value?.ok === false && value.error) {
        setNotice("");
        setError(value.error);
      } else if (value?.pending === true) {
        setLoginPending({ url: value.loginUrl, code: value.userCode, warning: value.warning });
        setNotice("");
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
    const shouldFollowUp = (endpoint === "pull" || endpoint === "login/cli" || endpoint === "login/device") && value?.ok !== false && !value?.error && value?.pending !== true;
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn gsBtn--primary", type: "button", disabled: Boolean(busy) || Boolean(loginPending), onClick: () => void run("login/cli"), children: t("loginCli") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn", type: "button", disabled: Boolean(busy), onClick: () => void run("pull"), children: t("pull") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gsBtn gsBtn--danger", type: "button", disabled: Boolean(busy) || !signedIn, onClick: () => void run("logout"), children: t("logout") })
      ] }),
      busy ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--busy", children: t("busy") }) : null,
      loginPending ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsStatus gsStatus--busy", children: [
        t("loginWaiting"),
        loginPending.code ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          " \xB7 ",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: loginPending.code })
        ] }) : null,
        loginPending.url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          " \xB7 ",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { className: "gsLink", href: loginPending.url, target: "_blank", rel: "noreferrer", children: t("loginOpenBrowser") })
        ] }) : null
      ] }) : null,
      loginPending?.warning ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--warn", children: t("loginNoUrl") }) : null,
      notice ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsStatus gsStatus--ok", children: notice }) : null,
      error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "gsStatus gsStatus--error", children: [
        t("error"),
        ": ",
        error
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DiagnosticsRows, { diagnostics: status?.diagnostics, t }),
      status?.diagnostics && !status.diagnostics.imageInput ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gsHint", children: t("adapterHint") }) : null,
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
      VersionCard,
      {
        t,
        call: (endpoint, payload) => callRpc(
          rpc,
          endpoint,
          payload,
          endpoint === "plugin/update" ? 19e4 : RPC_CALL_TIMEOUT_MS
        )
      }
    ),
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
