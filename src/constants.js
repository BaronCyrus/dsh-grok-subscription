export const PLUGIN_ID = 'dsh-grok-subscription'
export const CORDIS_ID = 'grok-subscription'
export const PROVIDER_ID = 'grok-build'
export const DISPLAY_NAME = 'Grok Build (subscription)'
export const DISPLAY_NAME_ZH = 'Grok 订阅'
export const SETTINGS_NAMESPACE = 'grokSubscription'
export const LOCALE_NS = 'settings.grokSubscription'
export const CHANNEL = '/grok-subscription'
export const CREDENTIAL_REF_NAME = 'GROK_BUILD_ACCESS_TOKEN'

export const PROXY_BASE_URL = 'https://cli-chat-proxy.grok.com/v1'
export const MODELS_V2_URL = 'https://cli-chat-proxy.grok.com/v1/models-v2'
export const BILLING_CREDITS_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits'
export const USAGE_PAGE_URL = 'https://grok.com/?_s=usage'

export const TOKEN_AUTH_HEADER = 'X-XAI-Token-Auth'
export const TOKEN_AUTH_VALUE = 'xai-grok-cli'
export const CLIENT_IDENTIFIER_HEADER = 'x-grok-client-identifier'
export const CLIENT_VERSION_HEADER = 'x-grok-client-version'
/** Official CLI surface reused by this plugin's preferred login path. */
export const CLIENT_IDENTIFIER = 'grok-shell'
/**
 * Lowest release `POST /v1/responses` accepts in `x-grok-client-version`.
 * Measured 2026-10-01: `1.0.5` and `1.0.13-rc1` are HTTP 426, every release
 * at or above `1.0.13` is 200, and nothing is rejected for being ahead of
 * the CLI. A prerelease does not satisfy the comparison. Catalog and billing
 * reads are not gated, which is why Settings can look healthy while every
 * conversation fails.
 */
export const CLIENT_VERSION_MINIMUM = '1.0.13'
/**
 * Advertised when no CLI release is known, or the one on disk is older than
 * this. Kept far above CLIENT_VERSION_MINIMUM: the proxy's only failure mode
 * is a version that is too old, so tracking each CLI release is what goes
 * stale. `99.0.0` was accepted live on 2026-10-01.
 */
export const CLIENT_VERSION_FALLBACK = '99.0.0'

export const API_KEY_SCOPE = 'xai::api_key'
export const XAI_OAUTH_ISSUER = 'https://auth.x.ai'
/** Public OIDC client id of the official Grok CLI. Not a secret. */
export const GROK_OIDC_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'
export const SESSION_AUTH_MODES = Object.freeze(['oidc', 'external', 'web_login', 'grok'])
export const API_KEY_AUTH_MODES = Object.freeze(['api_key'])

export const AUTH_FILE_MAX_BYTES = 1_048_576
export const CATALOG_TIMEOUT_MS = 15_000
export const USAGE_TIMEOUT_MS = 8_000
export const STORE_TOKEN_TIMEOUT_MS = 5_000
/**
 * Renew the short-lived token this long before it actually expires, so a request
 * in flight cannot cross the boundary and get a 401.
 */
export const TOKEN_EXPIRY_SKEW_MS = 120_000
/** Ceiling for one OAuth token request (device poll or refresh). */
export const CLI_REFRESH_TIMEOUT_MS = 20_000
export const STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1000
export const MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
export const REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
export const REQUEST_IMAGE_MAX_BYTES = 1024 * 1024

export const FALLBACK_MODEL_IDS = Object.freeze(['grok-4.7', 'grok-4.6', 'grok-4.5'])

/**
 * Models proven to accept image input through the subscription proxy.
 *
 * Verified by sending a solid red image and asking its colour, with the same
 * question and no image as a control:
 *   grok-4.7 / grok-4.7-build-fast / grok-4.6 -> "Red"
 *   grok-4.5 -> "green", and it called a yellow square a "circle with a black
 *               outline" — it confabulates instead of seeing the image.
 * grok-4.5 is therefore deliberately absent: advertising image input for it
 * would ship confidently wrong answers.
 */
export const IMAGE_INPUT_MODEL_IDS = Object.freeze([
  'grok-4.7',
  'grok-4.7-build-fast',
  'grok-4.6',
])

/** Hard ceiling for optional dynamic imports (pi-ai / schemastery / dsh-llm). */
export const IMPORT_TIMEOUT_MS = 2_500

/** Short ceiling for credentials.resolve / credentialRef on status & currentToken. */
export const CREDENTIALS_IO_TIMEOUT_MS = 1_500
/** Host-side hard timeout for each Grok subscription RPC handler. */
export const RPC_HANDLER_TIMEOUT_MS = 8_000
/**
 * How long the sign-in RPC may wait for the device-code endpoint before the
 * panel answers without a link. Polling continues in the background either way.
 */
export const LOGIN_START_TIMEOUT_MS = 10_000
/** Login endpoints answer as soon as the URL is known, so one ceiling covers start + sync. */
export const LOGIN_HANDLER_TIMEOUT_MS = 20_000
