const API_SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

/**
 * Append standard security headers to a Response.
 * Mutation responses also get `Cache-Control: no-store`.
 */
export function withSecurityHeaders(
  response: Response,
  options?: { noStore?: boolean }
): Response {
  for (const [key, value] of Object.entries(API_SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  if (options?.noStore) {
    response.headers.set("Cache-Control", "no-store")
  }
  return response
}

/**
 * Create a JSON response with security headers pre-applied.
 */
export function secureJson(
  data: unknown,
  init?: ResponseInit & { noStore?: boolean }
): Response {
  const { noStore, ...responseInit } = init ?? {}
  const response = Response.json(data, responseInit)
  return withSecurityHeaders(response, { noStore: noStore ?? true })
}
