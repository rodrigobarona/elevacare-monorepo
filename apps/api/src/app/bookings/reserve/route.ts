import {
  ReserveBookingRequestSchema,
  ReserveBookingResponseSchema,
} from "@eleva/api-client"
import { reserveBooking, type ReserveBookingError } from "@eleva/scheduling"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, resolveApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { getBookingRedis } from "@/lib/booking-redis"
import { checkBot } from "@/lib/bot-protection"
import { isIanaTimeZone, PUBLIC_NOT_FOUND } from "@/lib/public-marketplace"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RESERVE_ERROR_STATUS: Record<ReserveBookingError, number> = {
  not_found: 404,
  CONSENT_VERSION_OUTDATED: 422,
  MODE_NOT_AVAILABLE_IN_COUNTRY: 422,
  MODE_LANGUAGE_MISMATCH: 422,
  PHONE_REQUIRED: 422,
  GUEST_REQUIRED: 422,
  SLOT_UNAVAILABLE: 422,
  SLOT_TAKEN: 409,
  db_error: 500,
}

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
    const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
    if (botVerdict?.isBot) {
      return secureJson({ error: "blocked" }, { status: 403, headers })
    }
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(
      request,
      auth.type === "anonymous" ? undefined : auth.session.user.id
    ),
    RATE_LIMITS.public,
    headers
  )
  if (rateLimited) return rateLimited

  const parsed = ReserveBookingRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const body = parsed.data
  if (!isIanaTimeZone(body.timezone)) {
    return secureJson(
      { error: "validation", message: "invalid timezone" },
      { status: 422, headers }
    )
  }

  const startsAt = new Date(body.startsAt)
  const endsAt = new Date(body.endsAt)
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

  const redis = getBookingRedis()
  if (!redis) {
    return secureJson({ error: "unavailable" }, { status: 503, headers })
  }

  const session =
    auth.type === "anonymous"
      ? undefined
      : { userId: auth.session.user.id, email: auth.session.user.email }

  if (!session && !body.guest) {
    return secureJson({ error: "GUEST_REQUIRED" }, { status: 422, headers })
  }

  let result
  try {
    result = await reserveBooking(redis, {
      username: body.username,
      eventTypeModeId: body.eventTypeModeId,
      startsAt,
      endsAt,
      timezone: body.timezone,
      language: body.language,
      memberCountry: body.memberCountry.toUpperCase(),
      linkToken: body.linkToken,
      guest: body.guest,
      session,
      phone: body.phone,
      consents: body.consents,
    })
  } catch (err) {
    console.error("[bookings/reserve] reservation failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  if (!result.ok) {
    if (result.error === "not_found") {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }
    if (result.error === "db_error") {
      console.error("[bookings/reserve] reservation write failed")
      return secureJson({ error: "internal" }, { status: 500, headers })
    }
    return secureJson(
      { error: result.error },
      { status: RESERVE_ERROR_STATUS[result.error], headers }
    )
  }

  return secureJson(
    ReserveBookingResponseSchema.parse({
      reservationId: result.reservationId,
      reservationToken: result.reservationToken,
      expiresAt: result.expiresAt.toISOString(),
    }),
    { status: 201, headers }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
