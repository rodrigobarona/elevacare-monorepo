import { AcceptExpertBookingResponseSchema } from "@eleva/api-client"
import { acceptBookingRequest, BookingRequestError } from "@eleva/scheduling"
import { getExpertProfileByUserId } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { rejectUnexpectedBody } from "@/lib/empty-body"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "events:manage")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  const unexpectedBody = await rejectUnexpectedBody(request, headers)
  if (unexpectedBody) return unexpectedBody

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return secureJson(
      { error: "validation", message: "invalid booking id" },
      { status: 422, headers }
    )
  }

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  try {
    const result = await acceptBookingRequest({
      actorUserId: session.user.id,
      orgId: profile.orgId,
      expertProfileId: profile.id,
      bookingId: id,
    })
    return secureJson(
      AcceptExpertBookingResponseSchema.parse({
        bookingId: result.bookingId,
        status: "confirmed",
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof BookingRequestError) {
      if (err.code === "not_found") {
        return secureJson(
          { error: "not found", message: "booking not found" },
          { status: 404, headers }
        )
      }
      if (err.code === "REQUEST_EXPIRED") {
        return secureJson(
          { error: "REQUEST_EXPIRED", message: "response window has ended" },
          { status: 409, headers }
        )
      }
      return secureJson(
        {
          error: "INVALID_STATUS",
          message: "booking is not awaiting confirmation",
        },
        { status: 409, headers }
      )
    }
    console.error("[expert/bookings/accept] failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
