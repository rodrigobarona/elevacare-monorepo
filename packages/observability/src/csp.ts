/**
 * Content-Security-Policy builder.
 *
 * Consolidates allow-listed hosts per vendor so the gateway (+ sub-app)
 * proxies compose one header without sprinkling literal strings across
 * the codebase. Add new hosts here + land an ADR when a new vendor ships.
 */

const assetOrigin = process.env.APP_ASSET_PREFIX
  ? [process.env.APP_ASSET_PREFIX]
  : []

const isPreview = process.env.VERCEL_ENV === "preview"
const vercelLive = isPreview
  ? ["https://vercel.live", "https://*.vercel.live"]
  : []

export const CSP_ALLOWLIST = {
  scriptSrc: [
    "'self'",
    ...assetOrigin,
    ...vercelLive,
    "https://js.stripe.com",
    "https://connect-js.stripe.com",
    "https://cdn.sentry-cdn.com",
    "'unsafe-inline'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
  ],
  connectSrc: [
    "'self'",
    ...assetOrigin,
    ...vercelLive,
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
    ...vercelLive,
    "https://js.stripe.com",
    "https://connect-js.stripe.com",
    "https://*.stripe.com",
    "https://*.daily.co",
  ],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  styleSrc: ["'self'", "'unsafe-inline'", ...assetOrigin],
  fontSrc: ["'self'", "data:", ...assetOrigin],
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
