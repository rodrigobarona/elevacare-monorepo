/**
 * Eleva v3 i18n configuration.
 *
 * Locales at launch: Portuguese (pt), English (en), Spanish (es).
 * EN is the default and served with no URL prefix; PT and ES get prefixed.
 *
 * This module is consumed by next-intl routing/middleware in
 * apps/web (via i18n/routing.ts + proxy.ts) and apps/app (via
 * proxy.ts cookie resolution), as well as by server/client
 * components via next-intl helpers.
 */

import { countryToLocale } from "./country-to-locale"

export const locales = ["en", "pt", "es"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

export const localeNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
}

export const cookieName = "ELEVA_LOCALE"

const COOKIE_MAX_AGE = 31536000 // 1 year

/**
 * Shape consumed by next-intl's createMiddleware. Typed loosely so it
 * does not hard-couple @eleva/config to a specific next-intl major.
 */
export interface I18nConfig {
  locales: readonly Locale[]
  defaultLocale: Locale
  localePrefix: "as-needed" | "never"
  localeDetection: boolean
  localeCookie: { name: string; maxAge: number }
}

/** Config for apps/web -- URL-prefixed locales (e.g. /pt/about). */
export const i18nConfig: I18nConfig = {
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
  localeCookie: { name: cookieName, maxAge: COOKIE_MAX_AGE },
}

/** Config for apps/app -- no locale in URLs, cookie-only detection. */
export const appI18nConfig: I18nConfig = {
  locales,
  defaultLocale,
  localePrefix: "never",
  localeDetection: true,
  localeCookie: { name: cookieName, maxAge: COOKIE_MAX_AGE },
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/**
 * Pure locale resolution utility. Shared across both apps and any server
 * code (API routes, email templates, etc.).
 *
 * Resolution chain:
 * 1. ELEVA_LOCALE cookie (explicit user preference)
 * 2. Accept-Language header (browser preference)
 * 3. x-vercel-ip-country geo header (Vercel infra)
 * 4. "en" fallback
 */
export function resolveLocaleFromHeaders(headers: {
  cookie?: string | null
  acceptLanguage?: string | null
  country?: string | null
}): Locale {
  if (headers.cookie) {
    const match = headers.cookie.match(
      new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`)
    )
    if (match && isLocale(match[1]!)) return match[1] as Locale
  }

  if (headers.acceptLanguage) {
    for (const part of headers.acceptLanguage.split(",")) {
      const lang = part.split(";")[0]!.trim().split("-")[0]!.toLowerCase()
      if (isLocale(lang)) return lang as Locale
    }
  }

  return countryToLocale(headers.country)
}
