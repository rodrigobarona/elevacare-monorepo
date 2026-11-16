import type { NextRequest, NextResponse } from "next/server"
import {
  cookieName,
  getLocaleCookieOptions,
  localeCookieValues,
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
 * A router prefetch: the browser fetching a page the visitor has not opened
 * (a link in view, such as the language switcher's `/es` link).
 */
export function isPrefetchRequest(req: NextRequest): boolean {
  if (req.headers.get("next-router-prefetch") === "1") return true
  if (req.headers.has("next-router-segment-prefetch")) return true
  if (req.headers.get("purpose") === "prefetch") return true
  return req.headers.get("sec-purpose")?.includes("prefetch") ?? false
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
  if (isPrefetchRequest(req)) return false

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
 *
 * When the browser sent ELEVA_LOCALE twice, the extra one is a host-only
 * leftover (only the shared cookie is written now). It is expired so the
 * shared cookie is the only copy left. The shared cookie is then left as is,
 * unless `explicit` says the locale came from the address (`/es/…`), which
 * is the visitor's choice rather than a guess between the two copies.
 * Call this after every other
 * `response.cookies.set` in the proxy: that API rewrites all Set-Cookie
 * headers from a by-name map, which would drop the raw expiry below (it has
 * the same name as the cookie set here).
 */
export function persistLocaleCookie(
  req: NextRequest,
  response: NextResponse,
  locale: Locale,
  { explicit = false }: { explicit?: boolean } = {}
): void {
  if (!shouldPersistLocaleCookie(req)) return
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const options = getLocaleCookieOptions(host)
  const sent = localeCookieValues(req.headers.get("cookie"))
  if (options.domain && sent.length > 1) {
    // Cookie order follows first creation, not the last save, so neither
    // copy can be trusted as the newer one. Every writer now sets only the
    // shared cookie, which holds the saved choice: leave it untouched and
    // drop the host-only copy, so the next request sees one cookie. An
    // address locale is a choice, not a guess: save it on the shared one.
    if (explicit) response.cookies.set(cookieName, locale, options)
    response.headers.append("Set-Cookie", expireHostOnlyLocaleCookie())
    return
  }
  if (sent.at(-1) === locale && !options.domain) return
  response.cookies.set(cookieName, locale, options)
}

/**
 * next-intl writes ELEVA_LOCALE itself whenever a request's address locale
 * (`/es/…`) differs from the cookie, always host-only, and also on router
 * prefetches. On `*.eleva.care` that created the second, host-only cookie.
 *
 * - Prefetch: the visitor did not open that page (the language switcher's
 *   links are prefetched while in view), so next-intl's cookie is removed
 *   from the response. No expiry is sent; the browser keeps what it has.
 *   Run this after other `response.cookies.set` calls, which would rebuild
 *   Set-Cookie from a map that still holds next-intl's value.
 * - Any other request, including a client-side (RSC) language switch:
 *   re-issued with the shared options.
 */
export function shareIntlLocaleCookie(
  req: NextRequest,
  response: NextResponse
): void {
  const value = response.cookies.get(cookieName)?.value
  if (!value) return
  if (isPrefetchRequest(req)) {
    const kept = response.headers
      .getSetCookie()
      .filter((cookie) => !cookie.startsWith(`${cookieName}=`))
    response.headers.delete("Set-Cookie")
    for (const cookie of kept) response.headers.append("Set-Cookie", cookie)
    return
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const options = getLocaleCookieOptions(host)
  if (!options.domain) return
  response.cookies.set(cookieName, value, options)
}

/** Set-Cookie that removes only the host-only ELEVA_LOCALE (no Domain). */
export function expireHostOnlyLocaleCookie(): string {
  return `${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
}
