/**
 * Eleva v3 i18n configuration.
 *
 * Locales at launch: Portuguese (pt), English (en), Spanish (es).
 * EN is the default and served with no URL prefix; PT and ES get prefixed.
 *
 * This module is consumed by next-intl's createMiddleware in
 * apps/{web,app}/src/proxy.ts and by server/client components via
 * next-intl helpers.
 */

export const locales = ["en", "pt", "es"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

export const localeNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
}

export const cookieName = "ELEVA_LOCALE"

/**
 * Shape consumed by next-intl's createMiddleware. Typed loosely so it
 * does not hard-couple @eleva/config to a specific next-intl major.
 */
export interface I18nConfig {
  locales: readonly Locale[]
  defaultLocale: Locale
  localePrefix: "as-needed"
  localeDetection: boolean
  localeCookie: { name: string }
}

export const i18nConfig: I18nConfig = {
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
  localeCookie: { name: cookieName },
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
