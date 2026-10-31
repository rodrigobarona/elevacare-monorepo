/* global process, URL */

/**
 * SSOT for the public media host (ADR-025).
 *
 * Public objects live in the R2 public bucket and are served from a custom
 * domain; everything that needs that host (object URLs, CSP, `next/image`
 * patterns, portrait and avatar checks) reads it from here, so moving the
 * host is one env var. Plain `.mjs` because `next.config.mjs` imports it.
 *
 * Frontends read `NEXT_PUBLIC_MEDIA_BASE_URL` (inlined at build, so it must
 * stay a literal `process.env` access); `apps/api` reads `R2_PUBLIC_BASE_URL`.
 * This file reaches client bundles, so no `node:` imports.
 */

/** Browsers PUT presigned uploads straight to the EU jurisdiction S3 endpoint. */
export const R2_S3_CSP_SOURCE = "https://*.eu.r2.cloudflarestorage.com"

/** Base URL without a trailing slash, or null when no host is configured. */
export function mediaBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.R2_PUBLIC_BASE_URL
  if (!raw) return null
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (
    process.env.VERCEL_ENV === "production" &&
    parsed.hostname.endsWith(".r2.dev")
  ) {
    throw new Error(
      "@eleva/config: r2.dev is rate-limited and not for production; set a custom media domain"
    )
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`
}

/** Origin of the media host for CSP, or null when no host is configured. */
export function mediaOrigin() {
  const base = mediaBaseUrl()
  return base ? new URL(base).origin : null
}

/**
 * Public URL for an object key. Without a configured host this stays a
 * root-relative path: images 404 rather than crash the page.
 */
export function mediaUrl(key) {
  return `${mediaBaseUrl() ?? ""}/${key}`
}

/** Object key for a URL on the media host, or null for any other URL. */
export function mediaKeyFromUrl(url) {
  const base = mediaBaseUrl()
  if (!base) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const location = `${parsed.origin}${parsed.pathname}`
  if (parsed.search || parsed.hash || !location.startsWith(`${base}/`)) {
    return null
  }
  return location.slice(base.length + 1) || null
}

/** `images.remotePatterns` for the media host; read at build time. */
export function mediaRemotePatterns() {
  const base = mediaBaseUrl()
  if (!base) return []
  const { protocol, hostname, port, pathname } = new URL(base)
  return [
    {
      protocol: protocol.replace(":", ""),
      hostname,
      ...(port ? { port } : {}),
      pathname: `${pathname.replace(/\/+$/, "")}/**`,
    },
  ]
}
