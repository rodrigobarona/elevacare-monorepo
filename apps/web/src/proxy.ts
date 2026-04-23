import createIntl from "next-intl/middleware"
import { i18nConfig } from "@eleva/config/i18n"
import { withHeaders } from "@eleva/observability/proxy"

// Gateway proxy (apps/web): next-intl handles locale detection + prefix
// rewrites; the app-zone's internal proxy handles auth gating. The
// gateway itself stays public for marketing + /[username] routes.
const intl = createIntl({
  locales: i18nConfig.locales as unknown as string[],
  defaultLocale: i18nConfig.defaultLocale,
  localePrefix: i18nConfig.localePrefix,
  localeDetection: i18nConfig.localeDetection,
  localeCookie: i18nConfig.localeCookie,
})

export default withHeaders(intl)

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
