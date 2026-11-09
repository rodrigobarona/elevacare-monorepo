import { env } from "@eleva/config/env"

export function corsHeaders(
  request: Request,
  methods: string = "GET, OPTIONS"
): Record<string, string> {
  const origin = request.headers.get("origin") ?? ""
  const allowOrigin = matchAllowedOrigin(origin)

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers":
      "authorization, content-type, idempotency-key, x-api-key, x-correlation-id, x-eleva-org",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin
    headers["Access-Control-Allow-Credentials"] = "true"
  }
  return headers
}

/**
 * First-party hosts that may call the API from a browser with credentials.
 * `dev.eleva.care` and its admin host serve the production deployment today
 * (environment matrix, 2026-11-07), so they stay on the list.
 */
const FIRST_PARTY_HOSTS = new Set([
  "eleva.care",
  "dev.eleva.care",
  "app.eleva.care",
  "account.eleva.care",
  "admin.eleva.care",
  "admin.dev.eleva.care",
  "expert.eleva.care",
  "api.eleva.care",
])

const PREVIEW_HOST_SUFFIX = ".preview.eleva.care"

export function matchAllowedOrigin(
  origin: string,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): string | null {
  if (!origin) return null

  const e = env()
  const explicit = (e.APP_URL ?? "").replace(/\/$/, "")
  if (explicit && origin === explicit) return origin

  const url = safeUrl(origin)
  if (!url) return null

  if (
    e.NODE_ENV === "development" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return origin
  }

  // Credentialed cross-origin calls only over HTTPS.
  if (url.protocol !== "https:") return null

  if (FIRST_PARTY_HOSTS.has(url.hostname)) return origin
  // Preview deployments run their own API, database and secrets; the
  // production API never trusts them.
  if (vercelEnv !== "production" && url.hostname.endsWith(PREVIEW_HOST_SUFFIX))
    return origin

  return null
}

export function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url
  } catch {
    return null
  }
}
