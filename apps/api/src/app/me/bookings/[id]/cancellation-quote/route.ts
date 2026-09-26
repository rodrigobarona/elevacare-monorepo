import { CancellationQuoteSchema } from "@eleva/api-client"
import {
  MemberBookingPolicyError,
  quoteMemberCancellation,
} from "@eleva/scheduling"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
import {
  MEMBER_BOOKING_POLICY_STATUS,
  serializeCancellationQuote,
} from "@/lib/member-booking-http"
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const { id } = await params

  let session
  try {
    session = await requireMemberApiAuth(request)
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

  try {
    const quote = await quoteMemberCancellation({
      userId: session.user.id,
      orgId: session.orgId,
      bookingId: id,
    })
    return secureJson(
      CancellationQuoteSchema.parse(serializeCancellationQuote(quote)),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof MemberBookingPolicyError) {
      return secureJson(
        { error: err.code },
        { status: MEMBER_BOOKING_POLICY_STATUS[err.code], headers }
      )
    }
    console.error("[me/bookings/cancellation-quote] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
