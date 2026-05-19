import { getSession, type ElevaSession, UnauthorizedError } from "@eleva/auth"

export type ApiAuthResult =
  | { type: "session"; session: ElevaSession }
  | { type: "bearer"; session: ElevaSession }
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
    const expected = process.env.ELEVA_API_BEARER_TOKEN
    if (token && expected && token === expected) {
      const session = sessionFromBearerHeaders(request)
      if (session) return { type: "bearer", session }
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

  if (auth.type === "bearer") {
    return auth.session
  }

  if (auth.type === "anonymous") {
    throw new UnauthorizedError("no-session")
  }

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

function sessionFromBearerHeaders(request: Request): ElevaSession | null {
  const headers = request.headers
  const userId = headers.get("x-eleva-user-id")
  const workosUserId = headers.get("x-eleva-workos-user-id")
  const email = headers.get("x-eleva-user-email")
  const orgId = headers.get("x-eleva-org-id")
  const workosOrgId = headers.get("x-eleva-workos-org-id")
  const productLabel = headers.get("x-eleva-product-label")
  const workosRole = headers.get("x-eleva-workos-role")

  if (
    !userId ||
    !workosUserId ||
    !email ||
    !orgId ||
    !workosOrgId ||
    !isProductLabel(productLabel) ||
    !isWorkosRole(workosRole)
  ) {
    return null
  }

  return {
    user: {
      id: userId,
      workosUserId,
      email,
      displayName: headers.get("x-eleva-user-display-name"),
      avatarUrl: null,
    },
    orgId,
    workosOrgId,
    orgSlug: headers.get("x-eleva-org-slug"),
    productLabel,
    workosRole,
    capabilities: splitHeader(headers.get("x-eleva-capabilities")),
    entitlements: splitHeader(headers.get("x-eleva-entitlements")),
  }
}

function splitHeader(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function isProductLabel(
  value: string | null
): value is ElevaSession["productLabel"] {
  return (
    value === "member" ||
    value === "expert" ||
    value === "team_admin" ||
    value === "lecturer" ||
    value === "staff"
  )
}

function isWorkosRole(
  value: string | null
): value is ElevaSession["workosRole"] {
  return value === "admin" || value === "member"
}
