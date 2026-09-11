import { after } from "next/server"
import {
  RescheduleMeBookingRequestSchema,
  RescheduleMeBookingResponseSchema,
} from "@eleva/api-client"
import {
  MemberBookingPolicyError,
  rescheduleMemberBooking,
} from "@eleva/scheduling"
import { sendRescheduleIcsEmail } from "@eleva/workflows/scheduling"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
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
    session = await requireApiAuth(request)
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

  const parsed = RescheduleMeBookingRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const startsAt = new Date(parsed.data.startsAt)
  const endsAt = new Date(parsed.data.endsAt)
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    return secureJson(
      { error: "validation", message: "invalid slot" },
      { status: 422, headers }
    )
  }

  try {
    const result = await rescheduleMemberBooking({
      userId: session.user.id,
      bookingId: id,
      startsAt,
      endsAt,
    })
    after(() =>
      sendRescheduleIcsEmail(result.ics, result.previousStartsAt).catch(
        (err) => {
          console.error("[me/bookings/reschedule] ICS email failed", err)
        }
      )
    )
    return secureJson(
      RescheduleMeBookingResponseSchema.parse({
        ok: true,
        bookingId: id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof MemberBookingPolicyError) {
      return secureJson(
        { error: err.code },
        { status: POLICY_STATUS[err.code], headers }
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
