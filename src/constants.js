export const PLUGIN_ID = 'dsh-grok-subscription'
export const CORDIS_ID = 'grok-subscription'
export const PROVIDER_ID = 'grok-build'
export const DISPLAY_NAME = 'Grok Build (subscription)'
export const DISPLAY_NAME_ZH = 'Grok 订阅'
export const SETTINGS_NAMESPACE = 'grokSubscription'
export const LOCALE_NS = 'settings.grokSubscription'
export const CHANNEL = '/grok-subscription'
export const RPC_METHOD_PREFIX = 'grok-subscription'
export const CREDENTIAL_REF_NAME = 'GROK_BUILD_ACCESS_TOKEN'

export const PROXY_ORIGIN = 'https://cli-chat-proxy.grok.com'
export const PROXY_BASE_URL = 'https://cli-chat-proxy.grok.com/v1'
export const RESPONSES_URL = 'https://cli-chat-proxy.grok.com/v1/responses'
export const MODELS_V2_URL = 'https://cli-chat-proxy.grok.com/v1/models-v2'
export const BILLING_CREDITS_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits'
export const USAGE_PAGE_URL = 'https://grok.com/?_s=usage'

export const TOKEN_AUTH_HEADER = 'X-XAI-Token-Auth'
export const TOKEN_AUTH_VALUE = 'xai-grok-cli'
export const CLIENT_IDENTIFIER_HEADER = 'x-grok-client-identifier'
export const CLIENT_VERSION_HEADER = 'x-grok-client-version'
/** Official CLI surface reused by this plugin's preferred login path. */
export const CLIENT_IDENTIFIER = 'grok-shell'
/** Documented fallback when ~/.grok/version.json is absent. */
export const CLIENT_VERSION_FALLBACK = '1.0.5'

export const API_KEY_SCOPE = 'xai::api_key'
export const LEGACY_SIGNIN_SCOPE = 'https://accounts.x.ai/sign-in'
export const XAI_OAUTH_ISSUER = 'https://auth.x.ai'
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
/** The official CLI needs a moment to start, refresh, and rewrite auth.json. */
export const CLI_REFRESH_TIMEOUT_MS = 20_000
export const STREAM_IDLE_TIMEOUT_MS = 10 * 60 * 1000
export const MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
export const REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
export const REQUEST_IMAGE_MAX_BYTES = 1024 * 1024

export const FALLBACK_MODEL_IDS = Object.freeze(['grok-4.7', 'grok-4.6', 'grok-4.5'])

/** Hard ceiling for optional dynamic imports (pi-ai / schemastery / dsh-llm). */
export const IMPORT_TIMEOUT_MS = 2_500

/** Short ceiling for credentials.resolve / credentialRef on status & currentToken. */
export const CREDENTIALS_IO_TIMEOUT_MS = 1_500
/** Host-side hard timeout for each Grok subscription RPC handler. */
export const RPC_HANDLER_TIMEOUT_MS = 8_000
