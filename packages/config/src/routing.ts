/**
 * Gateway routing constants shared between apps/web (rewrites + proxy
 * bypass) and apps/app (proxy bypass for auth pages).
 *
 * After the org-slug routing migration, most app pages live under
 * /[orgSlug]/*. Only a few first-level segments remain fixed.
 */

/** First-level segments that the app owns (no org slug prefix). */
export const APP_FIXED_SEGMENTS = ["onboarding", "account", "admin"] as const

/** Auth-related standalone paths (no session needed). */
export const APP_STANDALONE_PATHS = [
  "auth-redirect",
  "callback",
  "logout",
  "signin",
  "signup",
] as const

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
 * All first-level paths that the app claims. Any first segment NOT
 * in this set and NOT a locale may be an org slug (handled by [orgSlug]
 * dynamic route in the app).
 */
export const APP_REWRITE_PATHS = [
  ...APP_FIXED_SEGMENTS,
  ...APP_STANDALONE_PATHS,
] as const

/**
 * @deprecated Use APP_FIXED_SEGMENTS + APP_STANDALONE_PATHS instead.
 * Kept temporarily for backward compatibility during migration.
 */
export const APP_ROOT_SEGMENTS = APP_FIXED_SEGMENTS
