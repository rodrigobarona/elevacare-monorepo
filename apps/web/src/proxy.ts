import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./i18n/routing"
import { APP_ROOT_SEGMENTS, APP_STANDALONE_PATHS } from "@eleva/config/routing"
import { locales } from "@eleva/config/i18n"

const intlMiddleware = createMiddleware(routing)

const appPaths = new Set<string>([
  ...APP_ROOT_SEGMENTS,
  ...APP_STANDALONE_PATHS,
])

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

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const firstSegment = pathname.split("/")[1] ?? ""

  if (appPaths.has(firstSegment)) {
    return
  }

  if (isRootPath(pathname) && request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth-redirect"
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
}
