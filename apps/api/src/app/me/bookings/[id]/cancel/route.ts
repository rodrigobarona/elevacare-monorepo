import { after } from "next/server"
import { CancelMeBookingResponseSchema } from "@eleva/api-client"
import {
  cancelMemberBooking,
  MemberBookingPolicyError,
} from "@eleva/scheduling"
import { sendCancellationIcsEmail } from "@eleva/workflows/scheduling"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
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

const POLICY_STATUS: Record<MemberBookingPolicyError["code"], number> = {
  not_found: 404,
  POLICY_TOO_LATE: 409,
  INVALID_STATUS: 409,
  SLOT_TAKEN: 409,
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")
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
    const result = await cancelMemberBooking({
      userId: session.user.id,
      orgId: session.orgId,
      bookingId: id,
    })
    after(() =>
      sendCancellationIcsEmail(result.ics).catch((err) => {
        console.error("[me/bookings/cancel] ICS email failed", err)
      })
    )
    return secureJson(
      CancelMeBookingResponseSchema.parse({ ok: true, bookingId: id }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof MemberBookingPolicyError) {
      return secureJson(
        { error: err.code },
        { status: POLICY_STATUS[err.code], headers }
      )
    }
    console.error("[me/bookings/cancel] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
