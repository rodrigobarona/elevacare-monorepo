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
 * response — only if the existing cookie differs, to avoid writing
 * a Set-Cookie header on every request.
 */
export function persistLocaleCookie(
  req: NextRequest,
  response: NextResponse,
  locale: Locale
): void {
  const existingCookie = req.cookies.get(cookieName)?.value
  if (existingCookie === locale) return
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  response.cookies.set(cookieName, locale, getLocaleCookieOptions(host))
}
