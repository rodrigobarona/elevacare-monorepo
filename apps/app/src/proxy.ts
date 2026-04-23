import createIntl from "next-intl/middleware"
import { i18nConfig } from "@eleva/config/i18n"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"

const intl = createIntl({
  locales: i18nConfig.locales as unknown as string[],
  defaultLocale: i18nConfig.defaultLocale,
  localePrefix: i18nConfig.localePrefix,
  localeDetection: i18nConfig.localeDetection,
  localeCookie: i18nConfig.localeCookie,
})

export default withHeaders(withAuth(intl))

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
