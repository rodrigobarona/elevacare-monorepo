import { NextResponse, type NextRequest } from "next/server"
import createIntl from "next-intl/middleware"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"
import { i18nConfig } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { APP_REWRITE_PATHS } from "@eleva/config/routing"

const APP_BYPASS = new Set(APP_REWRITE_PATHS.map((p) => `/${p}`))

function shouldBypass(pathname: string): boolean {
  if (APP_BYPASS.has(pathname)) return true
  for (const prefix of APP_BYPASS) {
    if (pathname.startsWith(prefix + "/")) return true
  }
  return false
}

const handler = (req: NextRequest) => {
  const pathname = req.nextUrl.pathname
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.next()
  }
  if (shouldBypass(pathname)) {
    return NextResponse.next()
  }

  const geoLocale = countryToLocale(req.headers.get("x-vercel-ip-country"))

  const intl = createIntl({
    locales: i18nConfig.locales as unknown as string[],
    defaultLocale: geoLocale,
    localePrefix: i18nConfig.localePrefix,
    localeDetection: i18nConfig.localeDetection,
    localeCookie: i18nConfig.localeCookie,
  })

  return intl(req)
}

export default withHeaders(withAuth(handler, { enforce: false }))

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
