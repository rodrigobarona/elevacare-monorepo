import { NextResponse, type NextRequest } from "next/server"
import createIntl from "next-intl/middleware"
import { i18nConfig } from "@eleva/config/i18n"
import { APP_STANDALONE_PATHS, APP_ROOT_SEGMENTS } from "@eleva/config/routing"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"

const intl = createIntl({
  locales: i18nConfig.locales as unknown as string[],
  defaultLocale: i18nConfig.defaultLocale,
  localePrefix: i18nConfig.localePrefix,
  localeDetection: i18nConfig.localeDetection,
  localeCookie: i18nConfig.localeCookie,
})

const SKIP_INTL = new Set([
  ...APP_STANDALONE_PATHS.map((p) => `/${p}`),
  ...APP_ROOT_SEGMENTS.map((p) => `/${p}`),
])

function shouldSkipIntl(pathname: string): boolean {
  if (SKIP_INTL.has(pathname)) return true
  for (const prefix of SKIP_INTL) {
    if (pathname.startsWith(prefix + "/")) return true
  }
  return false
}

const handler = (req: NextRequest) => {
  if (shouldSkipIntl(req.nextUrl.pathname)) {
    return NextResponse.next()
  }
  return intl(req)
}

const AUTH_FLOW_PATHS = APP_STANDALONE_PATHS.map((p) => `/${p}`)

export default withHeaders(
  withAuth(handler, {
    unauthenticatedPaths: [
      "/",
      "/home",
      "/about",
      "/legal/:path*",
      ...AUTH_FLOW_PATHS,
    ],
  })
)

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
