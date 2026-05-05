import { getRequestConfig } from "next-intl/server"
import type { AbstractIntlMessages } from "next-intl"
import { isLocale, type Locale } from "@eleva/config/i18n"
import { routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale =
    requested && isLocale(requested) ? requested : routing.defaultLocale
  const messages = (
    await import(`../messages/${locale}.json`, { with: { type: "json" } })
  ).default as AbstractIntlMessages
  return { locale, messages }
})
