/**
 * Cross-subdomain cookies belong on production (`.eleva.care`). Standard
 * Vercel preview hosts (`*.vercel.app`) reject that Domain attribute, so
 * preview and localhost stay host-only unless ELEVA_COOKIE_DOMAIN is set.
 */
export function crossSubDomainCookieConfig():
  | { enabled: true; domain: string }
  | { enabled: false } {
  const explicit = process.env.ELEVA_COOKIE_DOMAIN?.trim()
  if (explicit) {
    return { enabled: true, domain: explicit }
  }
  if (process.env.VERCEL_ENV === "production") {
    return { enabled: true, domain: ".eleva.care" }
  }
  return { enabled: false }
}
