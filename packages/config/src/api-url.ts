const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

/**
 * The API origin that server code sends forwarded session cookies to.
 * HTTPS everywhere except a loopback API in local development, so a
 * misconfigured URL never carries a session over plain HTTP.
 */
export function secureApiBaseUrl(
  url: string | undefined = process.env.NEXT_PUBLIC_API_URL
): string {
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid absolute URL")
  }
  if (parsed.protocol === "https:") return url
  if (parsed.protocol === "http:" && LOCAL_API_HOSTS.has(parsed.hostname)) {
    return url
  }
  throw new Error(
    "NEXT_PUBLIC_API_URL must use HTTPS outside local development"
  )
}
