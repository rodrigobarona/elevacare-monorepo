/**
 * Cross-subdomain cookies belong on production (`.eleva.care`). Preview
 * and local stay host-only even if ELEVA_COOKIE_DOMAIN is set — Vercel
 * preview hosts reject `.eleva.care`, and local Playwright needs host-only.
 */
export function crossSubDomainCookieConfig():
  | { enabled: true; domain: string }
  | { enabled: false } {
  const vercelEnv = process.env.VERCEL_ENV
  const isVercelProduction = vercelEnv === "production"
  const isSelfHostedProduction =
    !vercelEnv && process.env.NODE_ENV === "production"
  if (!isVercelProduction && !isSelfHostedProduction) {
    return { enabled: false }
  }
  const explicit = process.env.ELEVA_COOKIE_DOMAIN?.trim()
  return { enabled: true, domain: explicit || ".eleva.care" }
}
