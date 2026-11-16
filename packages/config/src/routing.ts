/**
 * Gateway routing constants shared between apps/web (rewrites + proxy
 * bypass) and the various micro-apps.
 *
 * After the org-slug routing migration, most app pages live under
 * /[orgSlug]/*. Only a few first-level segments remain fixed.
 */

/**
 * Signed-in surfaces live under a fixed first segment (ADR-026). The
 * namespace names the tool, so the gateway routes on the first segment
 * alone. Live: `/space` (the person's own Space, no slug) and `/expert/{slug}`
 * (expert tools — an expert's own practice or a clinician seat in a clinic).
 * `/team/{slug}` and `/academy/{slug}` follow and are reserved already.
 */
export const WORKSPACE_NAMESPACES = [
  "space",
  "expert",
  "team",
  "academy",
] as const

export type WorkspaceNamespace = (typeof WORKSPACE_NAMESPACES)[number]

/** Namespaces whose second segment is the workspace (org) slug. */
export const SLUGGED_WORKSPACE_NAMESPACES = [
  "expert",
  "team",
  "academy",
] as const

/** The person's own Space: `/space` (one per person, no slug). */
export const SPACE_BASE = "/space"

/** A page in the person's own Space, e.g. `spacePath("sessions")`. */
export function spacePath(segment = ""): string {
  const rest = segment.replace(/^\//, "")
  return rest ? `${SPACE_BASE}/${rest}` : SPACE_BASE
}

/** Expert tools for a workspace: `/expert/{slug}`. */
export function expertWorkspaceBase(orgSlug: string): string {
  return `/expert/${orgSlug}`
}

/** First-level segments owned by the account app (auth, onboarding, settings). */
export const ACCOUNT_FIXED_SEGMENTS = ["onboarding", "account"] as const

/** Auth-related standalone paths routed to the account app. */
export const ACCOUNT_STANDALONE_PATHS = [
  "dashboard",
  "callback",
  "logout",
  "login",
  "signup",
  "verify-email",
  "reset-password",
  "two-factor",
  // Organization invitations (the email links here; Phase 11).
  "accept-invitation",
] as const

/** All first-level paths that the account app claims. */
export const ACCOUNT_REWRITE_PATHS = [
  ...ACCOUNT_FIXED_SEGMENTS,
  ...ACCOUNT_STANDALONE_PATHS,
] as const

/** First-level segments owned by the member app: the person's Space and guest join. */
export const APP_FIXED_SEGMENTS = ["space", "join"] as const

/** Auth-related standalone paths (no session needed). */
export const APP_STANDALONE_PATHS = [] as const

/**
 * Second-level segments under `/{slug}/…`: the clinic admin and academy
 * zones (until they move to `/team` and `/academy`, ADR-026). The rest were
 * the member Space's pages before it moved to `/space`; they stay reserved
 * so no username can collide with a dashboard word.
 */
export const ORG_SCOPED_SEGMENTS = [
  "admin",
  "academy",
  "settings",
  "privacy",
  "sessions",
  "payments",
  "notifications",
  "reports",
] as const

/**
 * First-level paths that belong to the marketing zone (apps/web) even
 * for authenticated users. The web proxy must NOT rewrite these to
 * appOrigin regardless of session state.
 */
export const WEB_MARKETING_PATHS = [
  "home",
  "about",
  "history",
  "credits",
  "legal",
  "help",
  "support",
  "faq",
  "blog",
  "pricing",
  "experts",
  "book",
  "become-expert",
  "for-clinics",
  "for-organizations",
  "quiz",
  "health-quiz",
  "questionario",
  "cuestionario",
  "trust",
  "contact",
  "community",
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
  ...WORKSPACE_NAMESPACES,
  // Held for an academy catalogue or dashboard (ADR-026 fallbacks)
  "teach",
  "instructor",
  // Gateway-fixed segments (not org slugs)
  "admin",
  "docs",
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
 * Cookie used by the gateway and member app to remember the last org
 * a user was active in. Allows /dashboard and bare-/ to short-circuit
 * to /[orgSlug] without round-tripping to the DB.
 *
 * Set as httpOnly by app/proxy (server reads only).
 */
export const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

/**
 * What `eleva-last-org` remembers for an address (ADR-026): `space` for the
 * person's own Space, the slug in `/expert/{slug}` (and the other slugged
 * namespaces), or null for addresses that name no workspace. `/dashboard`
 * checks the value against the person's memberships before using it.
 */
export function lastActiveWorkspaceFromPath(pathname: string): string | null {
  const [first, second] = pathname.split("?")[0]!.split("/").filter(Boolean)
  if (first === "space") return "space"
  if (
    first &&
    (SLUGGED_WORKSPACE_NAMESPACES as readonly string[]).includes(first) &&
    second &&
    !RESERVED_SLUGS.has(second) &&
    isOrgSlugShape(second)
  ) {
    return second
  }
  return null
}

/**
 * Request header naming the workspace (org slug) a page acts for, taken from
 * its address. The API uses it instead of the session's active workspace,
 * and only when the person is a member of that workspace.
 */
export const ELEVA_ORG_HEADER = "x-eleva-org"

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
