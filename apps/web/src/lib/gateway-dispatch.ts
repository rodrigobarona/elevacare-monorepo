import { NextResponse, type NextRequest } from "next/server"
import {
  LAST_ACTIVE_ORG_COOKIE,
  RESERVED_SLUGS,
  isOrgSlugShape,
} from "@eleva/config/routing"
import type { GatewayOrigins } from "@eleva/config/dispatch"

/**
 * NextRequest-coupled helpers for the gateway proxy.
 *
 * Pure dispatch logic lives in @eleva/config/dispatch
 * (re-exported from @eleva/config). This module wraps that logic
 * with response builders that read cookies and craft redirects from
 * a NextRequest.
 */

export function resolveOriginsFromEnv(): GatewayOrigins {
  return {
    app: process.env.APP_ASSET_PREFIX || "http://localhost:3001",
    expert: process.env.EXPERT_ASSET_PREFIX || "http://localhost:3003",
    team: process.env.TEAM_ASSET_PREFIX || "http://localhost:3004",
    academy: process.env.ACADEMY_ASSET_PREFIX || "http://localhost:3005",
    account: process.env.ACCOUNT_ASSET_PREFIX || "http://localhost:3006",
  }
}

export function buildRewriteUrl(req: NextRequest, origin: string): URL {
  // `request.nextUrl.search` is "" when there are no query params, so
  // this concatenation is safe and does not require additional `?`
  // handling.
  return new URL(req.nextUrl.pathname + req.nextUrl.search, origin)
}

export function buildLoginRedirect(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  const returnTo = req.nextUrl.pathname + req.nextUrl.search
  url.pathname = "/login"
  url.search = `?returnTo=${encodeURIComponent(returnTo)}`
  return NextResponse.redirect(url)
}

/** True for App Router client navigations that expect an RSC payload. */
export function isRscRequest(req: NextRequest): boolean {
  return (
    req.headers.get("RSC") === "1" ||
    req.headers.get("Next-Router-Prefetch") === "1" ||
    req.headers.has("Next-Router-State-Tree") ||
    req.nextUrl.searchParams.has("_rsc")
  )
}

/**
 * True for top-level browser navigations (address bar, refresh, <a> without
 * client router). RSC/prefetch requests use cors/empty and must not redirect.
 */
export function isDocumentNavigation(req: NextRequest): boolean {
  const mode = req.headers.get("Sec-Fetch-Mode")
  const dest = req.headers.get("Sec-Fetch-Dest")
  if (mode !== null) {
    return mode === "navigate" && (dest === "document" || dest === "iframe")
  }
  return !isRscRequest(req)
}

/**
 * Hybrid root redirect: if a valid `eleva-last-org` cookie exists,
 * skip the /dashboard hop and land the user directly on /[lastOrg].
 * Otherwise let the account /dashboard page handle onboarding vs
 * first-org resolution.
 *
 * Saves up to two of the three redirects in the legacy chain
 * (/  ->  /dashboard  ->  /:slug) for returning users.
 */
export function buildRootRedirect(req: NextRequest): NextResponse {
  const lastSlug = req.cookies.get(LAST_ACTIVE_ORG_COOKIE)?.value
  const url = req.nextUrl.clone()
  if (lastSlug && !RESERVED_SLUGS.has(lastSlug) && isOrgSlugShape(lastSlug)) {
    url.pathname = `/${lastSlug}`
  } else {
    url.pathname = "/dashboard"
  }
  return NextResponse.redirect(url)
}
