import type { NextRequest, NextResponse } from "next/server"
import {
  APP_FIXED_SEGMENTS,
  ACCOUNT_STANDALONE_PATHS,
  ACCOUNT_FIXED_SEGMENTS,
  LAST_ACTIVE_ORG_COOKIE,
} from "@eleva/config/routing"
import { matchesPath } from "@eleva/observability/proxy"

const AUTH_FLOW_PATHS = ACCOUNT_STANDALONE_PATHS.map((p) => `/${p}`)

const fixedSegments = new Set<string>([
  ...APP_FIXED_SEGMENTS,
  ...ACCOUNT_FIXED_SEGMENTS,
])

/**
 * Paths that the member app serves publicly (marketing-shaped routes
 * + the WorkOS auth flow paths). Used both by the proxy (to skip the
 * unauthenticated redirect) AND by `trackLastActiveOrg` (to skip
 * cookie writes on non-org URLs).
 */
export const MEMBER_APP_UNAUTHENTICATED_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  ...AUTH_FLOW_PATHS,
] as const

/**
 * Persist the first URL segment as the "last active org" cookie so
 * /dashboard and other slug-less routes can return the user to where
 * they left off. Skips fixed segments (admin, account, onboarding)
 * and unauth paths, both of which are NOT org slugs.
 */
export function trackLastActiveOrg(
  req: NextRequest,
  response: NextResponse
): void {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean)
  const firstSegment = segments[0]
  if (
    !firstSegment ||
    matchesPath(req.nextUrl.pathname, MEMBER_APP_UNAUTHENTICATED_PATHS) ||
    fixedSegments.has(firstSegment)
  ) {
    return
  }
  const existingOrg = req.cookies.get(LAST_ACTIVE_ORG_COOKIE)?.value
  if (existingOrg === firstSegment) return
  response.cookies.set(LAST_ACTIVE_ORG_COOKIE, firstSegment, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: true,
  })
}
