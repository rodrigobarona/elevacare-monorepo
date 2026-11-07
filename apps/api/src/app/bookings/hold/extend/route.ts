import {
  ExtendBookingHoldRequestSchema,
  ExtendBookingHoldResponseSchema,
} from "@eleva/api-client"
import { extendReservationHold } from "@eleva/scheduling"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, resolveApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { checkBot } from "@/lib/bot-protection"
import { getBookingRedis } from "@/lib/booking-redis"
import { PUBLIC_NOT_FOUND } from "@/lib/public-marketplace"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

/**
 * POST /bookings/hold/extend — give an active booking hold 5 more
 * minutes so a member is never timed out mid-booking (WCAG 2.2.1).
 * The one-time reservation token is the capability, as on confirm.
 */
export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let auth
  try {
    auth = await resolveApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  if (auth.type !== "bearer") {
    const botVerdict = await checkBot({
      checkLevel: "deepAnalysis",
      enforceable: true,
    })
    if (botVerdict?.isBot) {
      return secureJson({ error: "blocked" }, { status: 403, headers })
    }
  }

  const sessionUserId =
    auth.type === "anonymous" ? undefined : auth.session.user.id
  const rateLimited = await applyRateLimit(
    rateLimitKey(request, sessionUserId),
    RATE_LIMITS.public,
    headers
  )
  if (rateLimited) return rateLimited

  const parsed = ExtendBookingHoldRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 400, headers }
    )
  }

  const result = await extendReservationHold(getBookingRedis(), {
    ...parsed.data,
    sessionUserId,
  })
  if (!result.ok) {
    if (result.error === "not_found") {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }
    return secureJson(
      {
        error:
          result.error === "limit_reached"
            ? "HOLD_LIMIT_REACHED"
            : "HOLD_EXPIRED",
      },
      { status: 409, headers }
    )
  }

  return secureJson(
    ExtendBookingHoldResponseSchema.parse({
      expiresAt: result.expiresAt.toISOString(),
    }),
    { status: 200, headers }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
