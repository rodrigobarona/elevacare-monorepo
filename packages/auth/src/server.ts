import { cache } from "react"
import { cookies, headers } from "next/headers"
import { WorkOS } from "@workos-inc/node"
import { withAuth as authkitGetSession } from "@workos-inc/authkit-nextjs"
import { resolveSessionFromWorkosUser } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

/**
 * Server-side session loader. Wrapping the AuthKit `withAuth()`
 * helper (confusingly named on their side — it reads the session from
 * the cookie). Memoised per-request via React.cache.
 */
export const getSession = cache(async (): Promise<ElevaSession | null> => {
  // Touch headers + cookies so Next knows this is dynamic.
  void headers()
  void cookies()
  const workosSession = await authkitGetSession()
  if (!workosSession.user) return null
  return resolveSessionFromWorkosUser(workosSession.user.id)
})

/**
 * Convenience wrapper that throws UnauthorizedError if there is no
 * session or the requested capability is missing. Use in Server
 * Actions / Route Handlers where unauthed access is a hard error.
 */
export async function requireSession(
  capability?: string
): Promise<ElevaSession> {
  const session = await getSession()
  if (!session) throw new UnauthorizedError("no-session")
  if (capability && !session.capabilities.includes(capability)) {
    throw new UnauthorizedError("missing-capability", `missing: ${capability}`)
  }
  return session
}

let _workos: WorkOS | null = null

function getWorkOS(): WorkOS {
  if (!_workos) {
    const key = process.env.WORKOS_API_KEY
    if (!key) throw new Error("WORKOS_API_KEY is required")
    _workos = new WorkOS(key)
  }
  return _workos
}

/**
 * Generate a WorkOS widget token for the given user + organization.
 * Used by the Pipes connection widget on the integrations/calendars pages.
 *
 * Prefer `getWidgetTokenFromSession()` in most cases to avoid trusting
 * caller-supplied IDs.
 */
export async function getWidgetToken(
  userId: string,
  organizationId: string
): Promise<string> {
  if (!userId || !organizationId) {
    throw new Error("getWidgetToken: userId and organizationId are required")
  }
  const workos = getWorkOS()
  const response = await workos.widgets.createToken({ userId, organizationId })
  return response.token
}

/**
 * Session-aware variant that derives userId and organizationId from
 * the authenticated session. Throws UnauthorizedError if there is no
 * active session.
 */
export async function getWidgetTokenFromSession(): Promise<string> {
  const session = await requireSession()
  return getWidgetToken(session.user.workosUserId, session.workosOrgId)
}
