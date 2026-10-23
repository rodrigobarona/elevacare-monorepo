import type { NextRequest, NextResponse } from "next/server"
import {
  cookieName,
  getLocaleCookieOptions,
  resolveLocaleFromHeaders,
  type Locale,
} from "@eleva/config/i18n"

/**
 * Resolve the user's locale from a NextRequest. Shared across every
 * Eleva app's proxy so the resolution chain (cookie → Accept-Language
 * → Vercel geo header → en) stays consistent.
 *
 * Pure function — does not mutate request/response.
 */
export function resolveLocaleForRequest(req: NextRequest): Locale {
  return resolveLocaleFromHeaders({
    cookie: req.headers.get("cookie"),
    acceptLanguage: req.headers.get("accept-language"),
    country: req.headers.get("x-vercel-ip-country"),
  })
}

/**
 * Persist the resolved locale to the ELEVA_LOCALE cookie on the
 * response. Skips when the value already matches and no shared-domain
 * upgrade is needed (localhost stays host-only).
 *
 * On `*.eleva.care`, a matching value still gets Set-Cookie with
 * `Domain=.eleva.care` so a host-only cookie from next-intl's syncCookie
 * is upgraded. Cookie headers do not expose Domain, so callers should
 * gate this on document navigations to avoid RSC/prefetch noise.
 */
export function persistLocaleCookie(
  req: NextRequest,
  response: NextResponse,
  locale: Locale
): void {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const options = getLocaleCookieOptions(host)
  const existingCookie = req.cookies.get(cookieName)?.value
  if (existingCookie === locale && !options.domain) return
  response.cookies.set(cookieName, locale, options)
}
