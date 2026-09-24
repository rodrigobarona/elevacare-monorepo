/**
 * Headers for server-side proxies that call `apps/api` with the browser
 * session cookie. Server Actions / RSC fetch() do not automatically forward
 * `Origin`, so cookie mutations would fail CSRF without synthesizing a
 * trusted origin from the incoming request host.
 */
export function buildApiSessionHeaders(
  incoming: Headers
): Record<string, string> | undefined {
  const headers: Record<string, string> = {}
  const cookie = incoming.get("cookie")
  if (cookie) headers.cookie = cookie

  const origin = incoming.get("origin")
  if (origin) {
    headers.origin = origin
  } else {
    const host = incoming.get("x-forwarded-host") ?? incoming.get("host")
    if (host) {
      const proto =
        incoming.get("x-forwarded-proto") ??
        (host.startsWith("localhost") ||
        host.startsWith("127.0.0.1") ||
        host.startsWith("[::1]")
          ? "http"
          : "https")
      headers.origin = `${proto}://${host}`
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined
}
