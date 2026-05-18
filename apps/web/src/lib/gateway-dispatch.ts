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
