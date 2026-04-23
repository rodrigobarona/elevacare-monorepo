import { cache } from "react"
import { cookies, headers } from "next/headers"
import { withAuth as authkitGetSession } from "@workos-inc/authkit-nextjs"
import { resolveSessionFromWorkosUser } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

/**
 * Server-side session loader. Wrap ping the AuthKit `withAuth()`
 * helper (confusingly named on their side \u2014 it reads the session from
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
