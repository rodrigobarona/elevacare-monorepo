import { getRequestConfig } from "next-intl/server"
import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"

const DEFAULT: Locale = defaultLocale

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = requested && isLocale(requested) ? requested : DEFAULT
  const messages = (
    await import(`../../messages/${locale}.json`, { with: { type: "json" } })
  ).default as Record<string, string>
  return { locale, messages }
})
