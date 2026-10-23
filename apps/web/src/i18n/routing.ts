import { defineRouting } from "next-intl/routing"
import { locales, defaultLocale, i18nConfig } from "@eleva/config/i18n"

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeCookie: i18nConfig.localeCookie,
})
