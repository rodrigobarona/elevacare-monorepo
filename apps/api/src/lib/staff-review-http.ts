import {
  apiAuthFailure,
  requireApiCapability,
  requireRevocableApiCapability,
} from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"

/**
 * Staff auth shared by the clinic review routes: `applications:review`,
 * rate limited per staff member. A decision needs a credential that can be
 * revoked (no bare JWT).
 */
export async function requireStaffReviewer(
  request: Request,
  headers: Record<string, string>,
  options: { decision?: boolean } = {}
): Promise<{ userId: string } | Response> {
  let session
  try {
    session = options.decision
      ? await requireRevocableApiCapability(request, "applications:review")
      : await requireApiCapability(request, "applications:review")
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
  return { userId: session.user.id }
}
