import type { NextRequest, NextResponse } from "next/server"
import {
  APP_FIXED_SEGMENTS,
  ACCOUNT_STANDALONE_PATHS,
  ACCOUNT_FIXED_SEGMENTS,
} from "@eleva/config/routing"

const AUTH_FLOW_PATHS = ACCOUNT_STANDALONE_PATHS.map((p) => `/${p}`)

const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

const fixedSegments = new Set<string>([
  ...APP_FIXED_SEGMENTS,
  ...ACCOUNT_FIXED_SEGMENTS,
])

const UNAUTH_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  ...AUTH_FLOW_PATHS,
] as const

/**
 * Check whether the request pathname is allowed without a session.
 * Supports both exact matches and a single-trailing-glob convention
 * (e.g. `/legal/:path*` matches `/legal/privacy`, `/legal/terms`).
 */
export function isUnauthenticatedPath(pathname: string): boolean {
  for (const pattern of UNAUTH_PATHS) {
    if (pattern.endsWith("/:path*")) {
      const prefix = pattern.slice(0, -"/:path*".length)
      if (pathname === prefix || pathname.startsWith(prefix + "/")) return true
    } else if (pathname === pattern) {
      return true
    }
  }
  return false
}

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
    isUnauthenticatedPath(req.nextUrl.pathname) ||
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
