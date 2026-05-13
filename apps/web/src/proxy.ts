import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./i18n/routing"
import {
  APP_FIXED_SEGMENTS,
  APP_STANDALONE_PATHS,
  ORG_SCOPED_SEGMENTS,
} from "@eleva/config/routing"
import { locales } from "@eleva/config/i18n"

const intlMiddleware = createMiddleware(routing)

const fixedAppPaths = new Set<string>([
  ...APP_FIXED_SEGMENTS,
  ...APP_STANDALONE_PATHS,
])

const orgScopedPaths = new Set<string>(ORG_SCOPED_SEGMENTS)

const localeSet = new Set<string>(locales)

const SESSION_COOKIE = process.env.WORKOS_COOKIE_NAME || "wos-session"

function isRootPath(pathname: string): boolean {
  if (pathname === "/") return true
  const first = pathname.split("/")[1] ?? ""
  return (
    localeSet.has(first) &&
    (pathname === `/${first}` || pathname === `/${first}/`)
  )
}

/**
 * Detect whether a request should be handled by the app zone.
 *
 * Matches:
 * 1. Fixed app segments: /onboarding, /account, /auth-redirect, etc.
 * 2. Org-slug-prefixed paths: /[orgSlug] where the first segment is
 *    not a locale and not a known marketing path. Heuristic: if a
 *    second segment exists and is an org-scoped segment (expert, admin,
 *    settings), it's definitely an app route. A bare /[slug] with a
 *    session cookie is also treated as an app route (org home).
 */
function isAppRoute(pathname: string, hasSession: boolean): boolean {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0] ?? ""
  const second = segments[1] ?? ""

  if (fixedAppPaths.has(first)) return true

  if (localeSet.has(first)) return false

  if (second && orgScopedPaths.has(second)) return true

  if (first && hasSession && !localeSet.has(first) && segments.length <= 1) {
    return true
  }

  return false
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  if (isAppRoute(pathname, hasSession)) {
    return
  }

  if (isRootPath(pathname) && hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth-redirect"
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
}
