import { logError } from "@eleva/observability"
import {
  CancelExpertBookingRequestSchema,
  CancelExpertBookingResponseSchema,
} from "@eleva/api-client"
import { cancelBookingByExpert, ExpertCancelError } from "@eleva/scheduling"
import { getExpertProfileForOrg } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Params = { params: Promise<{ id: string }> }

/**
 * The expert cancels one of their own confirmed sessions before it starts.
 * The member is refunded in full and both people are told.
 */
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

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return secureJson(
      { error: "validation", message: "invalid booking id" },
      { status: 422, headers }
    )
  }

  const parsed = CancelExpertBookingRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 400, headers }
    )
  }

  // The booking must belong to the caller's own expert profile in this
  // organisation: another expert's session answers 404 below.
  const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  try {
    const result = await cancelBookingByExpert({
      actorUserId: session.user.id,
      orgId: profile.orgId,
      expertProfileId: profile.id,
      bookingId: id,
      reason: parsed.data.reason,
    })
    return secureJson(
      CancelExpertBookingResponseSchema.parse({
        bookingId: id,
        status: "cancelled",
        refundCents: result.refundCents,
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof ExpertCancelError) {
      switch (err.code) {
        case "not_found":
          return secureJson(
            { error: "not found", message: "booking not found" },
            { status: 404, headers }
          )
        case "TOO_LATE":
          return secureJson(
            { error: "TOO_LATE", message: "the session has already started" },
            { status: 409, headers }
          )
        case "INVALID_STATUS":
          return secureJson(
            {
              error: "INVALID_STATUS",
              message: "booking is not a confirmed session",
            },
            { status: 409, headers }
          )
        default: {
          const _exhaustive: never = err.code
          return _exhaustive
        }
      }
    }
    logError("[expert/bookings/cancel] failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
