import { cache } from "react"
import { cookies, headers } from "next/headers"
import { WorkOS } from "@workos-inc/node"
import { withAuth as authkitGetSession } from "@workos-inc/authkit-nextjs"
import { unsealData } from "iron-session"
import { resolveSessionFromWorkosUser } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

interface WorkosCookieSession {
  accessToken: string
  refreshToken: string
  user: { id: string }
  impersonator?: unknown
}

/**
 * Read the WorkOS session directly from the cookie, bypassing the
 * middleware-header check that `withAuth()` enforces. Used as a
 * fallback when the proxy-injected `x-workos-middleware` request
 * header is not propagated to `headers()` (e.g. in Next.js 16 Route
 * Handlers).
 */
async function getWorkosUserFromCookie(): Promise<{ id: string } | null> {
  const password = process.env.WORKOS_COOKIE_PASSWORD
  if (!password) return null

  const cookieStore = await cookies()
  const cookieName = process.env.WORKOS_COOKIE_NAME || "wos-session"
  const cookie = cookieStore.get(cookieName)
  if (!cookie) return null

  try {
    const session = await unsealData<WorkosCookieSession>(cookie.value, {
      password,
    })
    return session.user ?? null
  } catch {
    return null
  }
}

/**
 * Server-side session loader. Tries AuthKit's header-based
 * `withAuth()` first (populated by the proxy via `authkit(req)`).
 * Falls back to direct cookie reading when the `x-workos-middleware`
 * request header is not forwarded — this happens in Next.js 16 Route
 * Handlers where `proxy.ts` sets the header via
 * `NextResponse.next({ request: { headers } })` but the runtime does
 * not propagate it to `headers()`.
 *
 * The cookie fallback only reads — no token refresh, no API call, no
 * cookie mutation — so it is safe in any server context.
 *
 * Memoised per-request via React.cache.
 */
export const getSession = cache(async (): Promise<ElevaSession | null> => {
  void headers()
  void cookies()

  let workosUserId: string | null = null
  try {
    const workosSession = await authkitGetSession()
    workosUserId = workosSession.user?.id ?? null
  } catch (err) {
    if (err instanceof Error && err.message.includes("AuthKit middleware")) {
      const user = await getWorkosUserFromCookie()
      workosUserId = user?.id ?? null
    } else {
      throw err
    }
  }

  if (!workosUserId) return null
  return resolveSessionFromWorkosUser(workosUserId)
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
