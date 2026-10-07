import { NextResponse, type NextRequest } from "next/server"
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
    docs: process.env.DOCS_ASSET_PREFIX || "http://localhost:3008",
  }
}

export function resolveAdminOrigin(): string {
  return (
    process.env.ADMIN_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "http://localhost:3007"
  )
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
 * Platform admin lives on admin.eleva.care (apps/admin). Root-domain
 * /admin/* requests redirect to the admin origin with the /admin prefix
 * stripped — admin app routes are root-relative on the subdomain.
 */
export function buildAdminRedirect(req: NextRequest): NextResponse {
  const origin = resolveAdminOrigin()
  const pathname = req.nextUrl.pathname
  const adminPath =
    pathname === "/admin"
      ? "/"
      : pathname.replace(/^\/admin(?=\/|$)/, "") || "/"
  const destination = new URL(adminPath + req.nextUrl.search, origin)
  return NextResponse.redirect(destination)
}
