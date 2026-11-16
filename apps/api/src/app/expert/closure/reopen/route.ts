import { ReopenExpertPracticeRequestSchema } from "@eleva/api-client"
import { reopenExpertPractice } from "@eleva/auth"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireRevocableApiCapability } from "@/lib/auth"
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
 * Reopen a closed practice while its username is held (ADR-026, founder
 * 2026-11-16). Owner only. The profile shows again only if it still passes
 * the public checks; delegates are invited again by the owner.
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

  // No body is fine; a body that is not JSON is refused, not read as {}.
  const text = await request.text()
  let json: unknown = {}
  if (text.trim().length > 0) {
    try {
      json = JSON.parse(text)
    } catch {
      return secureJson(
        { error: "validation", code: "INVALID_JSON" },
        { status: 422, headers }
      )
    }
  }
  const body = ReopenExpertPracticeRequestSchema.safeParse(json)
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const reopened = await reopenExpertPractice({
      orgId: session.orgId,
      actorUserId: session.user.id,
    })
    return secureJson(
      { practice: { slug: reopened.slug, closedAt: null } },
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
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
