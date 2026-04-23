/**
 * Content-Security-Policy builder.
 *
 * Consolidates allow-listed hosts per vendor so the gateway (+ sub-app)
 * proxies compose one header without sprinkling literal strings across
 * the codebase. Add new hosts here + land an ADR when a new vendor ships.
 */

export const CSP_ALLOWLIST = {
  scriptSrc: [
    "'self'",
    "https://js.stripe.com",
    "https://connect-js.stripe.com",
    "https://cdn.sentry-cdn.com",
    // Next.js 16 inlines scripts with a nonce; allow when set.
    "'unsafe-inline'",
  ],
  connectSrc: [
    "'self'",
    "https://api.eleva.care",
    "https://api.stripe.com",
    "https://m.stripe.com",
    "https://js.stripe.com",
    "https://connect-js.stripe.com",
    "https://*.daily.co",
    "https://*.sentry.io",
    "https://o*.ingest.sentry.io",
  ],
  frameSrc: [
    "'self'",
    "https://js.stripe.com",
    "https://connect-js.stripe.com",
    "https://*.stripe.com",
    "https://*.daily.co",
  ],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  fontSrc: ["'self'", "data:"],
  mediaSrc: ["'self'", "blob:", "https://*.daily.co"],
  workerSrc: ["'self'", "blob:"],
  formAction: ["'self'", "https://connect-js.stripe.com"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
} as const

export function buildCspHeader(
  overrides: Partial<Record<keyof typeof CSP_ALLOWLIST, readonly string[]>> = {}
): string {
  const merged: Record<string, readonly string[]> = {}
  for (const [k, v] of Object.entries(CSP_ALLOWLIST)) merged[k] = v
  for (const [k, v] of Object.entries(overrides)) {
    if (v) merged[k] = v
  }
  const dashed = (camel: string) =>
    camel.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
  return Object.entries(merged)
    .map(([k, v]) => `${dashed(k)} ${v.join(" ")}`)
    .join("; ")
}
