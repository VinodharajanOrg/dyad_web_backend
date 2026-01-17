/**
 * Maximum number of toast notifications visible at once
 */
export const VISIBLE_TOASTS = 10;

/**
 * Position of toast notifications on screen
 */
export const TOAST_POSITION = "bottom-right" as const;

/**
 * Query cache stale time (how long data is considered fresh before being marked as stale)
 * Default: 5 minutes
 */
export const STALE_TIME = 5 * 60 * 1000;

/**
 * Query cache garbage collection time (how long inactive cached data is kept in memory)
 * Default: 10 minutes
 */
export const GC_TIME = 10 * 60 * 1000;

/**
 * Chat messages cache stale time (aggressive caching to prevent multiple calls during navigation)
 * Default: 30 seconds
 */
export const CHAT_MESSAGES_STALE_TIME = 30 * 1000;

/**
 * Chat messages cache garbage collection time
 * Default: 5 minutes
 */
export const CHAT_MESSAGES_GC_TIME = 5 * 60 * 1000;

/**
 * Status API polling interval (how often to poll for status updates)
 * Default: 5 seconds
 */
export const POLLING_STATUS_API = 5000;

/**
 * Status API maximum polling duration (stop polling after this time)
 * Default: 2 minutes
 */
export const MAX_POLLING_STATUS_API = 3 * 60 * 1000;

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = ["/login", "/unauthorized"] as const;

/**
 * HTTP request timeout (how long to wait for a response before giving up)
 * Default: 30 seconds
 */
export const HTTP_TIMEOUT = 30 * 1000;

/**
 * Maximum number of HTTP redirects to follow
 * Default: 5
 */
export const MAX_HTTP_REDIRECTS = 5;

/**
 * Copy-to-clipboard feedback duration (how long "Copied!" message is shown)
 * Default: 2 seconds
 */
export const COPY_FEEDBACK_DURATION = 2000;

/**
 * Search input debounce delay (wait time after user stops typing before executing search)
 * Default: 150ms
 */
export const SEARCH_DEBOUNCE_DELAY = 150;

/**
 * Short animation/render delay (for immediate DOM updates after state changes)
 * Default: 10ms
 */
export const SHORT_ANIMATION_DELAY = 10;

/**
 * Transition animation duration (for fade-out effects)
 * Default: 300ms
 */
export const TRANSITION_DURATION = 300;

/**
 * Loading state delay (artificial delay for smooth UX transitions)
 * Default: 1.5 seconds
 */
export const LOADING_STATE_DELAY = 1500;

/**
 * One day in milliseconds (24 hours)
 * Default: 24 * 60 * 60 * 1000
 */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Token refresh buffer time (refresh tokens this long before expiry)
 * Default: 5 minutes
 */
export const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;

/**
 * Maximum number of chat turns to include in context
 * Default: 3
 */
export const MAX_CHAT_TURNS_IN_CONTEXT = 3;

/**
 * Turbo models list (stub for web mode)
 * Empty array
 */
export const TURBO_MODELS: string[] = [];
