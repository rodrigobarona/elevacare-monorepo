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

  if (!locale) {
    locale = DEFAULT
  }

  const messages = (
    await import(`../../messages/${locale}.json`, { with: { type: "json" } })
  ).default as Record<string, string>
  return { locale, messages }
})
