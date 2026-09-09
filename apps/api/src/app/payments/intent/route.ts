import {
  CreatePaymentIntentRequestSchema,
  CreatePaymentIntentResponseSchema,
} from "@eleva/api-client"
import { createPaymentIntentForReservation } from "@eleva/billing/server"
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

  const parsed = CreatePaymentIntentRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const sessionUserId =
    auth.type === "anonymous" ? undefined : auth.session.user.id

  let result
  try {
    result = await createPaymentIntentForReservation({
      reservationId: parsed.data.reservationId,
      reservationToken: parsed.data.reservationToken,
      sessionUserId,
    })
  } catch (err) {
    console.error("[payments/intent] failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  if (!result.ok) {
    if (result.error === "not_found") {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }
    if (result.error === "unavailable") {
      return secureJson({ error: "unavailable" }, { status: 503, headers })
    }
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  return secureJson(
    CreatePaymentIntentResponseSchema.parse({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      bookingId: result.bookingId,
      publishableKey: result.publishableKey,
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
