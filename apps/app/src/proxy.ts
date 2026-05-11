import { NextResponse, type NextRequest } from "next/server"
import createIntl from "next-intl/middleware"
import { i18nConfig } from "@eleva/config/i18n"
import { APP_STANDALONE_PATHS } from "@eleva/config/routing"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"

const intl = createIntl({
  locales: i18nConfig.locales as unknown as string[],
  defaultLocale: i18nConfig.defaultLocale,
  localePrefix: i18nConfig.localePrefix,
  localeDetection: i18nConfig.localeDetection,
  localeCookie: i18nConfig.localeCookie,
})

const SKIP_INTL = new Set(APP_STANDALONE_PATHS.map((p) => `/${p}`))

const handler = (req: NextRequest) => {
  if (SKIP_INTL.has(req.nextUrl.pathname)) {
    return NextResponse.next()
  }
  return intl(req)
}

export default withHeaders(withAuth(handler))

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
