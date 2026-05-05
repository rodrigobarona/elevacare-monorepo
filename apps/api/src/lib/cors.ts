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
      "authorization, content-type, x-correlation-id",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin
    headers["Access-Control-Allow-Credentials"] = "true"
  }
  return headers
}

export function matchAllowedOrigin(origin: string): string | null {
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

  if (url.hostname.endsWith(".preview.eleva.care")) {
    return origin
  }

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
