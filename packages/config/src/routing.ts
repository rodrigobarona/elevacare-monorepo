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
  "dashboard",
  "callback",
  "logout",
  "login",
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
 * First-level paths that belong to the marketing zone (apps/web) even
 * for authenticated users. The web proxy must NOT rewrite these to
 * appOrigin regardless of session state.
 */
export const WEB_MARKETING_PATHS = [
  "home",
  "about",
  "legal",
  "help",
  "blog",
  "pricing",
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
 * Slug values that must never be assigned to an organization. Includes
 * all gateway-reserved segments, marketing paths, Next.js metadata
 * convention routes, and common static asset directories.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...ACCOUNT_REWRITE_PATHS,
  ...APP_FIXED_SEGMENTS,
  ...WEB_MARKETING_PATHS,
  ...ORG_SCOPED_SEGMENTS,
  // Next.js metadata file convention routes
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
  "sitemap",
  "robots",
  "manifest",
  // Infrastructure paths
  "api",
  "trpc",
  "_next",
  "_vercel",
  // Common static asset directories
  "fonts",
  "images",
  "assets",
  "static",
  "icons",
])

/**
 * @deprecated Use APP_FIXED_SEGMENTS + ACCOUNT_FIXED_SEGMENTS instead.
 */
export const APP_ROOT_SEGMENTS = APP_FIXED_SEGMENTS

/**
 * Cookie used by the gateway and member app to remember the last org
 * a user was active in. Allows /dashboard and bare-/ to short-circuit
 * to /[orgSlug] without round-tripping to the DB.
 *
 * Set as httpOnly by app/proxy (server reads only).
 */
export const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

/**
 * Shape check for a candidate org slug pulled from a URL segment.
 *
 * Mirrors the format rules enforced by validateUsername() in
 * reserved-usernames.ts (lowercase a-z0-9, hyphens, 3-30 chars,
 * no leading/trailing/consecutive hyphens) but performs ONLY shape
 * checks -- callers must layer reserved-name and locale checks on
 * top. Used by apps/web/src/proxy.ts to decide whether an unknown
 * first segment should be treated as a potential org slug.
 */
const ORG_SLUG_SHAPE = /^[a-z0-9](?:[a-z0-9]|-(?!-)){1,28}[a-z0-9]$/

export function isOrgSlugShape(segment: string): boolean {
  return ORG_SLUG_SHAPE.test(segment)
}
