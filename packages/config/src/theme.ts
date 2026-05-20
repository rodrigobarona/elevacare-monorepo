/**
 * Eleva UI theme preference (light / dark / system).
 *
 * Persisted in ELEVA_THEME cookie on .eleva.care (shared across subdomains),
 * parallel to ELEVA_LOCALE in i18n.ts.
 */

import { getLocaleCookieDomain } from "./i18n"

export const themes = ["light", "dark", "system"] as const
export type ThemePreference = (typeof themes)[number]

export type ResolvedAppearance = "light" | "dark"

export const cookieName = "ELEVA_THEME"

const COOKIE_MAX_AGE = 31536000 // 1 year

export type ThemeCookieOptions = {
  path: string
  maxAge: number
  sameSite: "lax"
  domain?: string
}

export function isThemePreference(value: string): value is ThemePreference {
  return (themes as readonly string[]).includes(value)
}

export function parseThemeFromCookie(
  cookieHeader: string | null | undefined
): ThemePreference {
  if (!cookieHeader) return "system"

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`)
  )
  const raw = match?.[1]?.trim()
  if (!raw || !isThemePreference(raw)) return "system"
  return raw
}

export function getThemeCookieOptions(
  host?: string | null
): ThemeCookieOptions {
  const domain = getLocaleCookieDomain(host)
  return {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    ...(domain && { domain }),
  }
}

/**
 * Map stored preference to html class / SSR appearance.
 * For `system`, callers pass prefersDark from Accept-CH or default false on server.
 */
export function resolveThemeClass(
  theme: ThemePreference,
  prefersDark = false
): ResolvedAppearance {
  if (theme === "dark") return "dark"
  if (theme === "light") return "light"
  return prefersDark ? "dark" : "light"
}

/** Client-side: write ELEVA_THEME on the shared domain when possible. */
export function persistThemeCookie(
  theme: ThemePreference,
  host?: string
): void {
  if (typeof document === "undefined") return

  const { domain, path, maxAge, sameSite } = getThemeCookieOptions(host)
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : ""
  const domainPart = domain ? `; Domain=${domain}` : ""

  document.cookie = `${cookieName}=${theme}; Path=${path}; Max-Age=${maxAge}; SameSite=${sameSite}${domainPart}${secure}`
}
