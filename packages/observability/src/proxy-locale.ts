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
 * Only page loads may write ELEVA_LOCALE. A Server Action POST, an RSC
 * payload, a router prefetch or any other background fetch carries the
 * cookie the browser had *before* the request, so writing it back would
 * undo a locale the request itself just saved (the settings language
 * Server Action), and on `*.eleva.care` it would also thrash Set-Cookie.
 */
export function shouldPersistLocaleCookie(req: NextRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false
  if (req.headers.has("next-action")) return false
  if (req.headers.get("rsc") === "1") return false
  if (req.headers.get("next-router-prefetch") === "1") return false
  if (req.headers.get("purpose") === "prefetch") return false
  if (req.headers.get("sec-purpose")?.includes("prefetch")) return false

  const dest = req.headers.get("sec-fetch-dest")
  // When the browser sends Sec-Fetch-Dest, require a document navigation.
  // When absent (tests, curl, older clients), still persist so the
  // marketing → auth locale handoff works.
  return dest === null || dest === "document"
}

/**
 * Persist the resolved locale to the ELEVA_LOCALE cookie on the
 * response, on page loads only (`shouldPersistLocaleCookie`). Skips when
 * the value already matches and no shared-domain cookie is needed
 * (localhost stays host-only).
 *
 * On `*.eleva.care`, a matching value still gets Set-Cookie with
 * `Domain=.eleva.care`: Cookie headers do not expose Domain, so the proxy
 * cannot tell whether the browser already holds the shared-domain cookie.
 */
export function persistLocaleCookie(
  req: NextRequest,
  response: NextResponse,
  locale: Locale
): void {
  if (!shouldPersistLocaleCookie(req)) return
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const options = getLocaleCookieOptions(host)
  const existingCookie = req.cookies.get(cookieName)?.value
  if (existingCookie === locale && !options.domain) return
  response.cookies.set(cookieName, locale, options)
}
