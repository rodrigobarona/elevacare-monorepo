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
 * expert's licence): `applications:review`, rate limited per staff member.
 *
 * A decision needs a signed-in session that started today (403
 * STEP_UP_REQUIRED otherwise): a console left open for days, or a cookie
 * taken from it, cannot verify a clinic or a licence. That rules out a bare
 * JWT, and an API key too: a key has no sign-in moment and does not expire,
 * so it could decide long after the person who made it last signed in.
 * Reading the queue or a filing takes any of them.
 */
export async function requireStaffReviewer(
  request: Request,
  headers: Record<string, string>,
  options: { decision?: boolean } = {}
): Promise<{ userId: string } | Response> {
  let session
  // A session whose start cannot be read is treated as old.
  let authenticatedAt: Date | null = null
  let viaKey = false
  try {
    if (options.decision) {
      const identity = await requireRevocableApiCapability(
        request,
        "applications:review"
      )
      authenticatedAt = identity.authenticatedAt ?? null
      viaKey = identity.authMode === "api-key"
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
    options.decision &&
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
      viaKey,
    })
    return secureJson(
      {
        error: "STEP_UP_REQUIRED",
        code: "STEP_UP_REQUIRED",
        message: viaKey
          ? "A decision needs a signed-in session from today. An API key cannot decide."
          : "Sign in again to decide.",
      },
      { status: 403, headers }
    )
  }
  return { userId: session.user.id }
}
