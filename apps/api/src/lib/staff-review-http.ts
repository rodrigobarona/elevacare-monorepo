import {
  apiAuthFailure,
  requireApiCapability,
  requireRevocableApiCapability,
} from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { STAFF_DECISION_SIGN_IN_MAX_AGE_MS } from "@eleva/config/clinic-verification"
import { isRecentSignIn } from "@eleva/config/practice-closure"

/**
 * Staff auth shared by the review routes (a clinic's legal identity, an
 * expert's licence): `applications:review`,
 * rate limited per staff member. A decision needs a credential that can be
 * revoked (no bare JWT), and from a browser, a session that started today
 * (403 STEP_UP_REQUIRED otherwise): a console left open for days, or a
 * cookie taken from it, cannot verify a clinic or a licence. An API key has no sign-in
 * moment; it is issued on purpose and can be revoked.
 */
export async function requireStaffReviewer(
  request: Request,
  headers: Record<string, string>,
  options: { decision?: boolean } = {}
): Promise<{ userId: string } | Response> {
  let session
  // A decision from anything but an API key is held to a recent sign-in. A
  // session whose start cannot be read is treated as old, never as a key.
  let mustBeRecent = false
  let authenticatedAt: Date | null = null
  try {
    if (options.decision) {
      const identity = await requireRevocableApiCapability(
        request,
        "applications:review"
      )
      mustBeRecent = identity.authMode !== "api-key"
      authenticatedAt = identity.authenticatedAt ?? null
      session = identity
    } else {
      session = await requireApiCapability(request, "applications:review")
    }
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }
  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited
  if (
    mustBeRecent &&
    !isRecentSignIn(
      authenticatedAt,
      new Date(),
      STAFF_DECISION_SIGN_IN_MAX_AGE_MS
    )
  ) {
    // Worth a line: an old session trying to decide is what a taken
    // cookie looks like. The staff member's id only.
    console.warn("[staff-review] decision refused: session not recent", {
      userId: session.user.id,
    })
    return secureJson(
      {
        error: "STEP_UP_REQUIRED",
        code: "STEP_UP_REQUIRED",
        message: "Sign in again to decide.",
      },
      { status: 403, headers }
    )
  }
  return { userId: session.user.id }
}
