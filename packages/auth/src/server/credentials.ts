export type CredentialSource = "cookie" | "authorization" | "api-key"

export const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const

export function cookieHeaderHasSession(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  return SESSION_COOKIE_NAMES.some(
    (name) => countCookieValues(cookieHeader, name) > 0
  )
}

export function countCookieValues(cookieHeader: string, name: string): number {
  return cookieHeader.split(";").filter((part) => {
    const trimmed = part.trim()
    return trimmed === name || trimmed.startsWith(`${name}=`)
  }).length
}

export function listCredentialSources(request: Request): CredentialSource[] {
  const sources: CredentialSource[] = []
  if (cookieHeaderHasSession(request.headers.get("cookie"))) {
    sources.push("cookie")
  }
  const authorization = request.headers.get("authorization")
  if (
    authorization?.toLowerCase().startsWith("bearer ") &&
    authorization.slice(7).trim()
  ) {
    sources.push("authorization")
  }
  if (request.headers.get("x-api-key")?.trim()) {
    sources.push("api-key")
  }
  return sources
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null
  const token = authorization.slice(7).trim()
  return token || null
}

/** Compact JWS: three base64url segments. JWT path also requires a `kid` header. */
export function isCompactJws(token: string): boolean {
  const parts = token.split(".")
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

export function compactJwsKid(token: string): string | null {
  if (!isCompactJws(token)) return null
  try {
    const header = JSON.parse(
      Buffer.from(token.split(".")[0]!, "base64url").toString("utf8")
    ) as { kid?: unknown }
    return typeof header.kid === "string" && header.kid.length > 0
      ? header.kid
      : null
  } catch {
    return null
  }
}

export function isJwtBearer(token: string): boolean {
  return compactJwsKid(token) !== null
}
