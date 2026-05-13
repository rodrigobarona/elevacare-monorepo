import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import {
  cookieName,
  defaultLocale,
  isLocale,
  type Locale,
} from "@eleva/config/i18n"

const DEFAULT: Locale = defaultLocale

export default getRequestConfig(async () => {
  let locale: Locale | undefined

  // 1. Read from the header set by our proxy (most reliable path)
  const hdrs = await headers()
  const fromHeader = hdrs.get("x-eleva-locale")
  if (fromHeader && isLocale(fromHeader)) {
    locale = fromHeader as Locale
  }

  // 2. Fallback: read directly from the ELEVA_LOCALE cookie
  if (!locale) {
    const jar = await cookies()
    const fromCookie = jar.get(cookieName)?.value
    if (fromCookie && isLocale(fromCookie)) {
      locale = fromCookie as Locale
    }
  }

  // 3. Fallback: parse Accept-Language header (defense-in-depth for edge
  //    cases where the proxy header and cookie are both absent)
  if (!locale) {
    const acceptLang = hdrs.get("accept-language")
    if (acceptLang) {
      for (const part of acceptLang.split(",")) {
        const lang = part.split(";")[0]!.trim().split("-")[0]!.toLowerCase()
        if (isLocale(lang)) {
          locale = lang as Locale
          break
        }
      }
    }
  }

  // 4. Ultimate fallback
  if (!locale) {
    locale = DEFAULT
  }

  const messages = (
    await import(`../../messages/${locale}.json`, { with: { type: "json" } })
  ).default as Record<string, string>
  return { locale, messages }
})
