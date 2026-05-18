import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./i18n/routing"
import {
  APP_FIXED_SEGMENTS,
  APP_STANDALONE_PATHS,
  ACCOUNT_FIXED_SEGMENTS,
  ACCOUNT_STANDALONE_PATHS,
  WEB_MARKETING_PATHS,
} from "@eleva/config/routing"
import { locales } from "@eleva/config/i18n"

const intlMiddleware = createMiddleware(routing)

const appOrigin = process.env.APP_ASSET_PREFIX || "http://localhost:3001"
const expertOrigin = process.env.EXPERT_ASSET_PREFIX || "http://localhost:3003"
const teamOrigin = process.env.TEAM_ASSET_PREFIX || "http://localhost:3004"
const academyOrigin =
  process.env.ACADEMY_ASSET_PREFIX || "http://localhost:3005"
const accountOrigin =
  process.env.ACCOUNT_ASSET_PREFIX || "http://localhost:3006"

const accountPaths = new Set<string>([
  ...ACCOUNT_FIXED_SEGMENTS,
  ...ACCOUNT_STANDALONE_PATHS,
])

const fixedAppPaths = new Set<string>([
  ...APP_FIXED_SEGMENTS,
  ...APP_STANDALONE_PATHS,
])

const marketingPaths = new Set<string>(WEB_MARKETING_PATHS)

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
 * Determine the internal origin for a request. Returns null if the
 * request should stay in the marketing zone (apps/web).
 *
 * Routing priority:
 * 1. Account paths (login, callback, onboarding, account/*) -> apps/account
 * 2. Fixed app-level paths (admin) -> apps/app
 * 3. Org-scoped second-segment dispatch: expert -> apps/expert,
 *    team -> apps/team, academy -> apps/academy
 * 4. Bare /[orgSlug] with a session cookie -> member app (apps/app)
 */
function resolveOrigin(pathname: string, hasSession: boolean): string | null {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0] ?? ""
  const second = segments[1] ?? ""

  if (accountPaths.has(first)) return accountOrigin
  if (fixedAppPaths.has(first)) return appOrigin

  if (localeSet.has(first)) return null
  if (marketingPaths.has(first)) return null

  if (second === "expert") return expertOrigin
  if (second === "team") return teamOrigin
  if (second === "academy") return academyOrigin

  if (second === "settings") return appOrigin

  if (first && hasSession && !localeSet.has(first) && segments.length <= 1) {
    return appOrigin
  }

  if (first && !localeSet.has(first) && second) {
    return appOrigin
  }

  return null
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  const origin = resolveOrigin(pathname, hasSession)
  if (origin) {
    const url = new URL(pathname + request.nextUrl.search, origin)
    return NextResponse.rewrite(url)
  }

  if (isRootPath(pathname) && hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
}
