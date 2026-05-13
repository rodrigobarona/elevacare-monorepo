import { NextResponse, type NextRequest } from "next/server"
import createIntl from "next-intl/middleware"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"
import { cookieName } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { APP_REWRITE_PATHS } from "@eleva/config/routing"
import { routing } from "./i18n/routing"

const APP_BYPASS = new Set(APP_REWRITE_PATHS.map((p) => `/${p}`))

function shouldBypass(pathname: string): boolean {
  if (APP_BYPASS.has(pathname)) return true
  for (const prefix of APP_BYPASS) {
    if (pathname.startsWith(prefix + "/")) return true
  }
  return false
}

const intl = createIntl(routing)

const handler = (req: NextRequest) => {
  if (shouldBypass(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (!req.cookies.has(cookieName)) {
    const geoLocale = countryToLocale(req.headers.get("x-vercel-ip-country"))
    if (geoLocale !== routing.defaultLocale) {
      req.cookies.set(cookieName, geoLocale)
    }
  }

  return intl(req)
}

export default withHeaders(withAuth(handler, { enforce: false }))

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
