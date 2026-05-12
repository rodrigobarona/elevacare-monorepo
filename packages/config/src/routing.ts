/**
 * Gateway routing constants shared between apps/web (rewrites + proxy
 * bypass) and apps/app (proxy bypass for auth pages).
 *
 * ROOT segments have sub-routes (e.g. /expert/schedule).
 * STANDALONE paths are leaf-only (e.g. /signin).
 */

export const APP_ROOT_SEGMENTS = [
  "patient",
  "expert",
  "org",
  "admin",
  "settings",
] as const

export const APP_STANDALONE_PATHS = [
  "auth-redirect",
  "callback",
  "logout",
  "signin",
  "signup",
] as const

export const APP_REWRITE_PATHS = [
  ...APP_ROOT_SEGMENTS,
  ...APP_STANDALONE_PATHS,
] as const
