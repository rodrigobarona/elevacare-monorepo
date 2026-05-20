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

import { z } from "zod"
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
const SHARED_COOKIE_DOMAIN = ".eleva.care"

export interface LocaleCookieOptions {
  path: "/"
  maxAge: number
  sameSite: "lax"
  httpOnly?: boolean
  domain?: string
}

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

export const LocaleSchema = z.enum(locales)

/**
 * Normalize any locale-ish value into Eleva's launch locale set.
 *
 * WorkOS may store BCP-47 values such as "pt-PT" while UI routes and
 * message bundles use only the base launch language ("pt").
 */
export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null

  const base = value.trim().split("-")[0]?.toLowerCase()
  return base && isLocale(base) ? base : null
}

export function normalizeWorkOSLocale(value: unknown): Locale | null {
  return normalizeLocale(value)
}

export function getLocaleCookieDomain(
  host: string | null | undefined
): string | undefined {
  if (!host) return undefined

  const hostname = host.split(":")[0]?.toLowerCase()
  if (!hostname) return undefined

  if (hostname === "eleva.care" || hostname.endsWith(".eleva.care")) {
    return SHARED_COOKIE_DOMAIN
  }

  return undefined
}

export function getLocaleCookieOptions(
  host?: string | null,
  options: { httpOnly?: boolean } = {}
): LocaleCookieOptions {
  const domain = getLocaleCookieDomain(host)
  return {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    ...(options.httpOnly !== undefined && { httpOnly: options.httpOnly }),
    ...(domain && { domain }),
  }
}

/**
 * Pure unauthenticated locale discovery utility. Authenticated dashboard
 * requests should prefer WorkOS user.locale first, then use this chain.
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
    const locale = normalizeLocale(match?.[1])
    if (locale) return locale
  }

  if (headers.acceptLanguage) {
    for (const part of headers.acceptLanguage.split(",")) {
      const locale = normalizeLocale(part.split(";")[0])
      if (locale) return locale
    }
  }

  return countryToLocale(headers.country)
}
