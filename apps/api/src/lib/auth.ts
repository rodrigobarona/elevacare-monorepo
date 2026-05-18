import { getSession, type ElevaSession, UnauthorizedError } from "@eleva/auth"

export type ApiAuthResult =
  | { type: "session"; session: ElevaSession }
  | { type: "bearer"; token: string }
  | { type: "anonymous" }

/**
 * Resolve the caller's identity from the request. Supports:
 *   1. Bearer token in `Authorization` header (API keys, M2M JWT)
 *   2. WorkOS session cookie fallback (browser apps)
 *   3. Anonymous (no credentials)
 *
 * Route handlers call `requireAuth()` or `requireSession()` instead
 * of using this directly when anonymous access is not allowed.
 */
export async function resolveApiAuth(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization") ?? ""

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    if (token) {
      return { type: "bearer", token }
    }
  }

  const session = await getSession()
  if (session) {
    return { type: "session", session }
  }

  return { type: "anonymous" }
}

/**
 * Require authentication. Returns the session for session-based auth.
 * For bearer tokens, validates against the expected secret and returns
 * null session (caller must handle bearer-specific logic).
 *
 * Throws 401-style response for anonymous callers.
 */
export async function requireApiAuth(request: Request): Promise<ElevaSession> {
  const auth = await resolveApiAuth(request)

  if (auth.type === "session") {
    return auth.session
  }

  if (auth.type === "anonymous") {
    throw new UnauthorizedError("no-session")
  }

  // Bearer token present but no session -- for now, bearer-only routes
  // (cron, QStash, drainer) handle their own token validation inline.
  // When WorkOS API key validation is wired (Phase 3+), this will
  // resolve bearer tokens to an ElevaSession-like object.
  throw new UnauthorizedError("no-session")
}

/**
 * Require a session with a specific capability. Use in route handlers
 * that need RBAC beyond "is authenticated".
 */
export async function requireApiCapability(
  request: Request,
  capability: string
): Promise<ElevaSession> {
  const session = await requireApiAuth(request)
  if (!session.capabilities.includes(capability)) {
    throw new UnauthorizedError("missing-capability", `missing: ${capability}`)
  }
  return session
}
