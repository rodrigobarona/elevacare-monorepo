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
    connectSrc: ["https://*.sentry.io", "https://*.ingest.sentry.io"],
  },
  workos: {
    connectSrc: ["https://api.workos.com"],
    frameSrc: ["https://api.workos.com"],
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

/**
 * Vercel Live / Vercel Toolbar origins, per directive.
 *
 * Loaded by the platform from `https://vercel.live/_next-live/...` and
 * websocket-collaborates via `*.pusher.com`. The Toolbar (Comments,
 * Feature Flags, Edit Mode, Layout Shift Tool, Accessibility Audit,
 * etc.) is enabled by default on preview deployments and can ALSO be
 * enabled in production via Vercel project settings or the browser
 * extension. The trigger is therefore "any Vercel deployment", not
 * just preview.
 *
 * Minimal set sourced from the official Vercel docs + community
 * verification:
 *   - https://vercel.com/docs/workflow-collaboration/comments/specialized-usage
 *   - https://github.com/vercel/next.js/discussions/56562
 */
const VERCEL_LIVE: Record<string, readonly string[]> = {
  scriptSrc: ["https://vercel.live", "https://vercel.com"],
  connectSrc: [
    "https://vercel.live",
    "https://vercel.com",
    "https://*.pusher.com",
    "wss://*.pusher.com",
  ],
  frameSrc: ["https://vercel.live", "https://vercel.com"],
  imgSrc: ["https://vercel.live", "https://vercel.com"],
  styleSrc: ["https://vercel.com"],
  fontSrc: ["https://vercel.live", "https://assets.vercel.com"],
}

function resolveAllowlist(): Record<string, string[]> {
  const merged = mergeVendors()

  const ASSET_PREFIX_VARS = [
    "APP_ASSET_PREFIX",
    "API_ASSET_PREFIX",
    "EXPERT_ASSET_PREFIX",
    "TEAM_ASSET_PREFIX",
    "ACADEMY_ASSET_PREFIX",
    "ACCOUNT_ASSET_PREFIX",
    "DOCS_ASSET_PREFIX",
  ] as const
  const assetOrigin = [
    ...new Set(
      ASSET_PREFIX_VARS.flatMap((v) =>
        process.env[v] ? [process.env[v]!] : []
      )
    ),
  ]

  // Allow Vercel Live whenever we are on Vercel infra. The platform
  // injects the toolbar script only when enabled (preview default, or
  // production via project settings), so extra CSP entries are inert
  // when the script is not loaded.
  const isOnVercel = process.env.VERCEL === "1"

  const isDev = process.env.NODE_ENV === "development"

  if (assetOrigin.length) {
    for (const d of ["scriptSrc", "connectSrc", "styleSrc", "fontSrc"]) {
      merged[d]?.push(...assetOrigin)
    }
  }
  if (isOnVercel) {
    for (const [directive, origins] of Object.entries(VERCEL_LIVE)) {
      merged[directive] ??= []
      merged[directive].push(...origins)
    }
  }
  if (isDev) {
    merged.scriptSrc?.push("'unsafe-eval'", "'wasm-unsafe-eval'")
    merged.connectSrc?.push("http://127.0.0.1:*")
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
