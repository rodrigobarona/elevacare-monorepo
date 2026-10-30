import { z } from "zod"
import { AdminPartnerReviewResponseSchema } from "@eleva/api-client"
import { getLicenceReview } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
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

/** One profile's licence review: the latest filing and the profile behind it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ expertProfileId: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "applications:review")
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
  if (!id.success) {
    return secureJson(
      { error: "validation", issues: id.error.issues },
      { status: 422, headers }
    )
  }

  const review = await getLicenceReview(id.data)
  if (!review) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }
  const { profile, application } = review
  return secureJson(
    AdminPartnerReviewResponseSchema.parse({
      expertProfileId: profile.id,
      displayName: profile.displayName,
      username: profile.username,
      email: review.email,
      profileStatus: profile.status,
      reviewState: review.reviewState,
      application: application
        ? {
            id: application.id,
            status: application.status,
            professionalBody: application.professionalBody,
            licenceNumber: application.licenceNumber,
            ersRegistrationNumber: application.ersRegistrationNumber,
            submittedAt: application.submittedAt.toISOString(),
            reviewedAt: application.reviewedAt?.toISOString() ?? null,
            reason: application.reason,
          }
        : null,
    }),
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
