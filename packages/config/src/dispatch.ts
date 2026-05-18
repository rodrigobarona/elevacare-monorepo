import {
  ACCOUNT_FIXED_SEGMENTS,
  ACCOUNT_STANDALONE_PATHS,
  APP_FIXED_SEGMENTS,
  APP_STANDALONE_PATHS,
  WEB_MARKETING_PATHS,
  RESERVED_SLUGS,
  isOrgSlugShape,
} from "./routing"
import { locales } from "./i18n"

/**
 * Multi-zone routing dispatch (pure path -> decision).
 *
 * Consumed by apps/web/src/proxy.ts. Lives in @eleva/config so it can
 * be unit-tested without spinning up NextRequest mocks. Per
 * Next.js v16.2.2 + Vercel multi-zone guidance, STATIC dispatch could
 * be lifted into `next.config.rewrites` for lower latency, while
 * DYNAMIC dispatch (auth, cookies, locale, org-slug) MUST stay in the
 * proxy. Today everything routes through this single decision tree.
 */

export interface GatewayOrigins {
  app: string
  expert: string
  team: string
  academy: string
  account: string
}

export type Dispatch =
  | { kind: "marketing" }
  | { kind: "rewrite"; origin: string }
  | { kind: "unauth-slug"; slug: string }

const accountPrefixSegments = new Set<string>(ACCOUNT_FIXED_SEGMENTS)
const appPrefixSegments = new Set<string>(APP_FIXED_SEGMENTS)
const accountStandalone = new Set<string>(ACCOUNT_STANDALONE_PATHS)
const appStandalone = new Set<string>(APP_STANDALONE_PATHS)
const marketingPaths = new Set<string>(WEB_MARKETING_PATHS)
const localeSet = new Set<string>(locales)

/**
 * Decide how to dispatch a request based on its pathname and session
 * state.
 *
 * Routing priority:
 *  1. Locale-prefixed (/pt, /es, /en) -> marketing
 *  2. Marketing first-segments (/about, /pricing, ...) -> marketing
 *  3. Fixed account segments (/onboarding, /account/*) -> account zone
 *  4. Fixed app segments (/admin) -> app zone
 *  5. Account standalone (/dashboard, /login, /callback, /logout,
 *     /signup) at depth 1 -> account zone
 *  6. App standalone at depth 1 -> app zone
 *  7. Org-scoped second segment (/:slug/expert|team|academy|settings)
 *     -> respective satellite app
 *  8. Bare or deeper /:slug with valid shape:
 *       hasSession -> app zone (member app handles org check)
 *       !hasSession -> unauth-slug (caller redirects to /login)
 *  9. Anything else -> marketing
 */
export function resolveDispatch(
  pathname: string,
  hasSession: boolean,
  origins: GatewayOrigins
): Dispatch {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0] ?? ""
  const second = segments[1] ?? ""
  const depth = segments.length

  if (!first) return { kind: "marketing" }

  if (localeSet.has(first)) return { kind: "marketing" }
  if (marketingPaths.has(first)) return { kind: "marketing" }

  if (accountPrefixSegments.has(first)) {
    return { kind: "rewrite", origin: origins.account }
  }
  if (appPrefixSegments.has(first)) {
    return { kind: "rewrite", origin: origins.app }
  }

  if (depth === 1 && accountStandalone.has(first)) {
    return { kind: "rewrite", origin: origins.account }
  }
  if (depth === 1 && appStandalone.has(first)) {
    return { kind: "rewrite", origin: origins.app }
  }

  const isSlug = !RESERVED_SLUGS.has(first) && isOrgSlugShape(first)

  if (isSlug && second === "expert")
    return { kind: "rewrite", origin: origins.expert }
  if (isSlug && second === "team")
    return { kind: "rewrite", origin: origins.team }
  if (isSlug && second === "academy")
    return { kind: "rewrite", origin: origins.academy }
  if (isSlug && second === "settings")
    return { kind: "rewrite", origin: origins.app }

  if (isSlug) {
    if (hasSession) {
      return { kind: "rewrite", origin: origins.app }
    }
    return { kind: "unauth-slug", slug: first }
  }

  return { kind: "marketing" }
}

/**
 * True when the pathname is the bare root, optionally prefixed by a
 * known locale (e.g. `/`, `/pt`, `/es/`).
 */
export function isRootPath(pathname: string): boolean {
  if (pathname === "/") return true
  const first = pathname.split("/")[1] ?? ""
  return (
    localeSet.has(first) &&
    (pathname === `/${first}` || pathname === `/${first}/`)
  )
}
