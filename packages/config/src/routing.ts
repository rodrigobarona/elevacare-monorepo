/**
 * Gateway routing constants shared between apps/web (rewrites + proxy
 * bypass) and the various micro-apps.
 *
 * After the org-slug routing migration, most app pages live under
 * /[orgSlug]/*. Only a few first-level segments remain fixed.
 */

/** First-level segments owned by the account app (auth, onboarding, settings). */
export const ACCOUNT_FIXED_SEGMENTS = ["onboarding", "account"] as const

/** Auth-related standalone paths routed to the account app. */
export const ACCOUNT_STANDALONE_PATHS = [
  "auth-redirect",
  "callback",
  "logout",
  "signin",
  "signup",
] as const

/** All first-level paths that the account app claims. */
export const ACCOUNT_REWRITE_PATHS = [
  ...ACCOUNT_FIXED_SEGMENTS,
  ...ACCOUNT_STANDALONE_PATHS,
] as const

/** First-level segments owned by the member app. */
export const APP_FIXED_SEGMENTS = ["admin"] as const

/** Auth-related standalone paths (no session needed). */
export const APP_STANDALONE_PATHS = [] as const

/**
 * Second-level segments that appear under /[orgSlug]/*. Used by
 * the web proxy to detect org-slug-prefixed app routes.
 */
export const ORG_SCOPED_SEGMENTS = [
  "expert",
  "team",
  "academy",
  "settings",
] as const

/**
 * All first-level paths that the gateway claims (union of account + app).
 * Any first segment NOT in this set and NOT a locale may be an org slug.
 */
export const APP_REWRITE_PATHS = [
  ...ACCOUNT_REWRITE_PATHS,
  ...APP_FIXED_SEGMENTS,
  ...APP_STANDALONE_PATHS,
] as const

/**
 * @deprecated Use APP_FIXED_SEGMENTS + ACCOUNT_FIXED_SEGMENTS instead.
 */
export const APP_ROOT_SEGMENTS = APP_FIXED_SEGMENTS
