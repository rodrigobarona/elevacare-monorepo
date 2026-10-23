/**
 * Cross-subdomain cookies belong on production (`.eleva.care`) and staging
 * (`.dev.eleva.care`). Preview and local stay host-only even if
 * ELEVA_COOKIE_DOMAIN is set — Vercel preview hosts reject parent domains,
 * and local Playwright needs host-only.
 *
 * Staging must NOT use `.eleva.care`: that jar is shared with production and
 * breaks OAuth state / session cookies when secrets differ.
 */
export function defaultCookieDomain(
  authUrl: string | undefined = process.env.BETTER_AUTH_URL
): string {
  if (authUrl) {
    try {
      const host = new URL(authUrl).hostname
      if (host === "dev.eleva.care" || host.endsWith(".dev.eleva.care")) {
        return ".dev.eleva.care"
      }
    } catch {
      // fall through to production default
    }
  }
  return ".eleva.care"
}

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
  const inferred = defaultCookieDomain()
  const explicit = process.env.ELEVA_COOKIE_DOMAIN?.trim()
  // Staging must never ship `.eleva.care` cookies (shared jar with prod).
  if (
    inferred === ".dev.eleva.care" &&
    (!explicit || explicit === ".eleva.care")
  ) {
    return { enabled: true, domain: ".dev.eleva.care" }
  }
  return { enabled: true, domain: explicit || inferred }
}
