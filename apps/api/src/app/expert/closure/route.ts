import { CloseExpertPracticeRequestSchema } from "@eleva/api-client"
import { closeExpertPractice } from "@eleva/auth"
import { isRecentSignIn } from "@eleva/config/practice-closure"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireRevocableApiCapability } from "@/lib/auth"
import { withIdempotency } from "@/lib/idempotency"
import {
  practiceClosureError,
  practiceClosureFailure,
} from "@/lib/practice-closure"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Close the expert practice in the session's workspace (ADR-026 decision
 * 10). Owner only, with a recent sign-in and the practice's username typed
 * to confirm; refused with the open blockers while anything must finish.
 * Optional `Idempotency-Key` makes a retried request safe.
 */
export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireRevocableApiCapability(request, "expert:onboard")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  return withIdempotency(
    request,
    {
      scope: "expert.closure",
      actor: rateLimitKey(request, session.user.id),
      headers,
    },
    async () => {
      if (!isRecentSignIn(session.authenticatedAt)) {
        return practiceClosureError(
          "STEP_UP_REQUIRED",
          "Sign in again to close your practice.",
          headers
        )
      }

      const body = CloseExpertPracticeRequestSchema.safeParse(
        await request.json().catch(() => ({}))
      )
      if (!body.success) {
        return secureJson(
          { error: "validation", issues: body.error.issues },
          { status: 422, headers }
        )
      }

      try {
        const closed = await closeExpertPractice({
          orgId: session.orgId,
          actorUserId: session.user.id,
          confirmSlug: body.data.confirmSlug,
        })
        return secureJson(
          {
            practice: {
              slug: closed.slug,
              closedAt: closed.closedAt.toISOString(),
              removedMembers: closed.removedMembers,
              cancelledInvitations: closed.cancelledInvitations,
            },
          },
          { status: 200, headers }
        )
      } catch (err) {
        const failure = practiceClosureFailure(err, headers)
        if (failure) return failure
        throw err
      }
    }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
