import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import {
  resolveLocaleFromHeaders,
  normalizeLocale,
  type Locale,
} from "@eleva/config/i18n"
import { getAuthenticatedWorkOSLocale } from "@eleva/auth/server"
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
 *  1. WorkOS user.locale (authenticated source of truth)
 *  2. `x-eleva-locale` header (set by the auth proxy)
 *  3. ELEVA_LOCALE cookie (pre-auth preference / mirror)
 *  4. Accept-Language header (browser preference)
 *  5. x-vercel-ip-country geo header
 *  6. defaultLocale fallback
 */
export async function resolveServerLocale(): Promise<Locale> {
  const workosLocale = await getAuthenticatedWorkOSLocale()
  if (workosLocale) return workosLocale

  const hdrs = await headers()
  const fromHeader = hdrs.get("x-eleva-locale")
  const headerLocale = normalizeLocale(fromHeader)
  if (headerLocale) return headerLocale

  const jar = await cookies()
  return resolveLocaleFromHeaders({
    cookie: jar.toString(),
    acceptLanguage: hdrs.get("accept-language"),
    country: hdrs.get("x-vercel-ip-country"),
  })
}
