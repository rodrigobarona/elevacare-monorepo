import { redirect } from "next/navigation"
import { getSession, getSessionForOrg } from "./server"
import type { ElevaSession } from "./types"

export const LOGIN_PATH = "/login" as const

/**
 * Page/layout guard -- redirects to the login page when there is no
 * active session. Returns a non-null ElevaSession so call sites skip
 * the manual null check.
 *
 * For Server Actions / Route Handlers that should throw instead of
 * redirecting, use `requireSession()` from `@eleva/auth/server`.
 */
export async function guardSession(): Promise<ElevaSession> {
  const session = await getSession()
  if (!session) redirect(LOGIN_PATH)
  return session
}

/**
 * Org-scoped variant of `guardSession`. Resolves the session using the
 * org slug from URL params so multi-org users land in the correct org
 * context. Redirects to the login page when unauthenticated.
 */
export async function guardSessionForOrg(
  orgSlug: string
): Promise<ElevaSession> {
  const session = await getSessionForOrg(orgSlug)
  if (!session) redirect(LOGIN_PATH)
  return session
}
