import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import {
  cookieName,
  defaultLocale,
  isLocale,
  type Locale,
} from "@eleva/config/i18n"
import { getDashboardMessages } from "@eleva/dashboard/messages"

const DEFAULT: Locale = defaultLocale

export default getRequestConfig(async () => {
  let locale: Locale | undefined

  const hdrs = await headers()
  const fromHeader = hdrs.get("x-eleva-locale")
  if (fromHeader && isLocale(fromHeader)) {
    locale = fromHeader as Locale
  }

  if (!locale) {
    const jar = await cookies()
    const fromCookie = jar.get(cookieName)?.value
    if (fromCookie && isLocale(fromCookie)) {
      locale = fromCookie as Locale
    }
  }

  if (!locale) {
    locale = DEFAULT
  }

  const [appMessages, dashboardMessages] = await Promise.all([
    import(`../../messages/${locale}.json`, { with: { type: "json" } }).then(
      (m) => m.default as Record<string, unknown>
    ),
    getDashboardMessages(locale),
  ])
  return { locale, messages: { ...appMessages, ...dashboardMessages } }
})
