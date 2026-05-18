import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import {
  cookieName,
  defaultLocale,
  isLocale,
  type Locale,
} from "@eleva/config/i18n"
import { getDashboardMessages } from "./messages"

type MessageLoader = (locale: Locale) => Promise<Record<string, unknown>>

/**
 * Shared next-intl request config factory for all dashboard apps.
 *
 * Each app passes a loader for its own `messages/<locale>.json`;
 * locale resolution and dashboard message merging are handled here.
 */
export function createRequestConfig(loadAppMessages: MessageLoader) {
  return getRequestConfig(async () => {
    const locale = await resolveServerLocale()

    const [appMessages, dashboardMessages] = await Promise.all([
      loadAppMessages(locale),
      getDashboardMessages(locale),
    ])

    return { locale, messages: { ...appMessages, ...dashboardMessages } }
  })
}

/**
 * Resolve the user's locale inside a Server Component / route handler.
 *
 * Resolution chain (mirrors the proxy's `resolveLocaleForRequest`):
 *  1. `x-eleva-locale` header (set by the auth proxy — most reliable)
 *  2. ELEVA_LOCALE cookie (explicit user preference)
 *  3. Accept-Language header (browser preference)
 *  4. defaultLocale fallback
 */
async function resolveServerLocale(): Promise<Locale> {
  const hdrs = await headers()

  const fromHeader = hdrs.get("x-eleva-locale")
  if (fromHeader && isLocale(fromHeader)) return fromHeader as Locale

  const jar = await cookies()
  const fromCookie = jar.get(cookieName)?.value
  if (fromCookie && isLocale(fromCookie)) return fromCookie as Locale

  const acceptLang = hdrs.get("accept-language")
  if (acceptLang) {
    for (const part of acceptLang.split(",")) {
      const lang = part.split(";")[0]!.trim().split("-")[0]!.toLowerCase()
      if (isLocale(lang)) return lang as Locale
    }
  }

  return defaultLocale
}
