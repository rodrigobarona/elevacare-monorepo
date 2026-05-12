/**
 * Content-Security-Policy builder.
 *
 * Vendor origins are grouped by integration so adding / removing a vendor
 * is a single self-contained block. The builder merges them per-directive
 * and layers on environment-dependent values (asset prefix, Vercel preview,
 * dev-mode eval) at call time.
 *
 * To add a new vendor: create a block in `VENDORS`, land an ADR.
 */

// ---------------------------------------------------------------------------
// Vendor definitions — one block per integration
// ---------------------------------------------------------------------------

type VendorEntry = Partial<Record<string, readonly string[]>>

const VENDORS: Record<string, VendorEntry> = {
  stripe: {
    scriptSrc: ["https://js.stripe.com", "https://connect-js.stripe.com"],
    connectSrc: [
      "https://api.stripe.com",
      "https://m.stripe.com",
      "https://js.stripe.com",
      "https://connect-js.stripe.com",
    ],
    frameSrc: [
      "https://js.stripe.com",
      "https://connect-js.stripe.com",
      "https://*.stripe.com",
    ],
    formAction: ["https://connect-js.stripe.com"],
  },
  daily: {
    connectSrc: ["https://*.daily.co"],
    frameSrc: ["https://*.daily.co"],
    mediaSrc: ["https://*.daily.co"],
  },
  sentry: {
    scriptSrc: ["https://cdn.sentry-cdn.com"],
    connectSrc: ["https://*.sentry.io", "https://o*.ingest.sentry.io"],
  },
  eleva: {
    connectSrc: ["https://api.eleva.care"],
  },
}

// ---------------------------------------------------------------------------
// Base directives (self + scheme sources that don't belong to any vendor)
// ---------------------------------------------------------------------------

const BASE_DIRECTIVES: Record<string, readonly string[]> = {
  scriptSrc: ["'self'", "'unsafe-inline'"],
  connectSrc: ["'self'"],
  frameSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  fontSrc: ["'self'", "data:"],
  mediaSrc: ["'self'", "blob:"],
  workerSrc: ["'self'", "blob:"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

function mergeVendors(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [key, values] of Object.entries(BASE_DIRECTIVES)) {
    result[key] = [...values]
  }
  for (const vendor of Object.values(VENDORS)) {
    for (const [directive, origins] of Object.entries(vendor)) {
      if (!origins) continue
      result[directive] ??= []
      result[directive].push(...origins)
    }
  }
  return result
}

function resolveAllowlist(): Record<string, string[]> {
  const merged = mergeVendors()

  const assetOrigin = process.env.APP_ASSET_PREFIX
    ? [process.env.APP_ASSET_PREFIX]
    : []

  const isPreview = process.env.VERCEL_ENV === "preview"
  const vercelLive = isPreview
    ? ["https://vercel.live", "https://*.vercel.live"]
    : []

  const isDev = process.env.NODE_ENV === "development"

  if (assetOrigin.length) {
    for (const d of ["scriptSrc", "connectSrc", "styleSrc", "fontSrc"]) {
      merged[d]?.push(...assetOrigin)
    }
  }
  if (vercelLive.length) {
    for (const d of ["scriptSrc", "connectSrc", "frameSrc"]) {
      merged[d]?.push(...vercelLive)
    }
  }
  if (isDev) {
    merged.scriptSrc?.push("'unsafe-eval'", "'wasm-unsafe-eval'")
    // #region agent log
    merged.connectSrc?.push("http://127.0.0.1:*")
    // #endregion
  }

  return merged
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CspDirective = keyof typeof BASE_DIRECTIVES

/** @deprecated Use `buildCspHeader()` — kept for tests that inspect the static list. */
export const CSP_ALLOWLIST = mergeVendors()

export function buildCspHeader(
  overrides: Partial<Record<string, readonly string[]>> = {}
): string {
  const allowlist = resolveAllowlist()
  const merged: Record<string, readonly string[]> = { ...allowlist }
  for (const [k, v] of Object.entries(overrides)) {
    if (v) merged[k] = v
  }
  const dashed = (camel: string) =>
    camel.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
  return Object.entries(merged)
    .map(([k, v]) => `${dashed(k)} ${v.join(" ")}`)
    .join("; ")
}
