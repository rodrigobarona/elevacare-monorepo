import { defineRouting } from "next-intl/routing"
import { i18nConfig } from "@eleva/config/i18n"

/**
 * next-intl routing config for apps/web.
 *
 * Single source of truth for locale-aware navigation. Keep this file
 * thin — actual locales live in `@eleva/config/i18n`.
 */
export const routing = defineRouting({
  locales: i18nConfig.locales,
  defaultLocale: i18nConfig.defaultLocale,
  localePrefix: i18nConfig.localePrefix,
  localeDetection: i18nConfig.localeDetection,
  localeCookie: i18nConfig.localeCookie,
})
