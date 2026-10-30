import { z } from "zod"
import {
  LicenceDecisionRequestSchema,
  LicenceDecisionResponseSchema,
} from "@eleva/api-client"
import {
  decideLicenceApplication,
  PartnerReviewError,
} from "@eleva/auth/partner-review"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireRevocableApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

const ExpertProfileIdSchema = z.string().uuid()

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Staff decision on an open licence application (approve, needs changes, reject). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ expertProfileId: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireRevocableApiCapability(
      request,
      "applications:review"
    )
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

  const { expertProfileId } = await params
  const id = ExpertProfileIdSchema.safeParse(expertProfileId)
  const body = LicenceDecisionRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!id.success || !body.success) {
    return secureJson(
      {
        error: "validation",
        issues: [...(id.error?.issues ?? []), ...(body.error?.issues ?? [])],
      },
      { status: 422, headers }
    )
  }

  const { applicationId, submittedAt, ...decision } = body.data
  try {
    const result = await decideLicenceApplication({
      expertProfileId: id.data,
      applicationId,
      submittedAt: new Date(submittedAt),
      actorUserId: session.user.id,
      decision,
    })
    return secureJson(LicenceDecisionResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (err instanceof PartnerReviewError) {
      return secureJson(
        { error: err.code, code: err.code, message: err.message },
        { status: err.status, headers }
      )
    }
    throw err
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
