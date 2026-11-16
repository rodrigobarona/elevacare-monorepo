import { getPracticeClosureState } from "@eleva/auth"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { practiceClosureFailure } from "@/lib/practice-closure"
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
 * Closure dry run (ADR-026 decision 10): whether the practice in the
 * session's workspace can close now, and what still blocks it.
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:onboard")
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

  try {
    const state = await getPracticeClosureState(session.orgId)
    return secureJson(
      {
        practice: {
          slug: state.slug,
          closedAt: state.closedAt?.toISOString() ?? null,
          canClose: state.canClose,
          blockers: state.blockers,
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

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
