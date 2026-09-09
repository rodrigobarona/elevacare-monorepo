import { after } from "next/server"
import {
  ConfirmBookingRequestSchema,
  ConfirmBookingResponseSchema,
} from "@eleva/api-client"
import { retrieveBookingPaymentIntent } from "@eleva/billing/server"
import { confirmBookingPayment } from "@eleva/scheduling"
import { publishPendingDomainEvents } from "@eleva/workflows/domain-events"
import { defaultDomainEventSubscribers } from "@eleva/workflows/subscribers"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, resolveApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { checkBot } from "@/lib/bot-protection"
import { PUBLIC_NOT_FOUND } from "@/lib/public-marketplace"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

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

  const parsed = ConfirmBookingRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 400, headers }
    )
  }

  const sessionUserId =
    auth.type === "anonymous" ? undefined : auth.session.user.id

  let result
  try {
    result = await confirmBookingPayment({
      reservationId: parsed.data.reservationId,
      reservationToken: parsed.data.reservationToken,
      paymentIntentId: parsed.data.paymentIntentId,
      sessionUserId,
      source: "public",
      retrieveIntent: retrieveBookingPaymentIntent,
    })
  } catch (err) {
    console.error("[bookings/confirm] failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  if (!result.ok) {
    if (result.error === "not_found") {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }
    if (result.error === "payment_mismatch") {
      return secureJson({ error: "PAYMENT_MISMATCH" }, { status: 409, headers })
    }
    if (result.error === "unavailable") {
      return secureJson({ error: "unavailable" }, { status: 503, headers })
    }
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  after(() =>
    publishPendingDomainEvents({
      subscribers: defaultDomainEventSubscribers(),
    }).catch((err) => {
      console.error("[bookings/confirm] publisher kick failed", err)
    })
  )

  return secureJson(
    ConfirmBookingResponseSchema.parse({
      bookingId: result.bookingId,
      alreadyConfirmed: result.alreadyConfirmed,
    }),
    { status: result.alreadyConfirmed ? 200 : 201, headers }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
