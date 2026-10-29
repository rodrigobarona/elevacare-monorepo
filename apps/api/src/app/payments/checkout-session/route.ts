import {
  CreateCheckoutSessionRequestSchema,
  CreateCheckoutSessionResponseSchema,
} from "@eleva/api-client"
import { resolveGatewayUrl } from "@eleva/config/env"
import { createCheckoutSessionForReservation } from "@eleva/billing/server"
import { BookingError } from "@eleva/scheduling"
import { corsHeaders, matchAllowedOrigin } from "@/lib/cors"
import { apiAuthFailure, resolveApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { checkBot } from "@/lib/bot-protection"
import { withIdempotency } from "@/lib/idempotency"
import { PUBLIC_NOT_FOUND } from "@/lib/public-marketplace"
import {
  paymentIntentBookabilityStatus,
  rejectIfMemberCannotBook,
} from "@/lib/member-bookability"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

/**
 * Paid booking payment via Stripe Checkout Sessions (`ui_mode: "elements"`).
 * Same capability-token auth as `/payments/intent`; the browser mounts the
 * returned client secret with `CheckoutElementsProvider`.
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

  const actorUserId =
    auth.type === "anonymous" ? undefined : auth.session.user.id

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, actorUserId),
    RATE_LIMITS.public,
    headers
  )
  if (rateLimited) return rateLimited

  return withIdempotency(
    request,
    {
      scope: "payments.checkout-session",
      actor: rateLimitKey(request, actorUserId),
      headers,
    },
    async () => {
      const parsed = CreateCheckoutSessionRequestSchema.safeParse(
        await request.json().catch(() => ({}))
      )
      if (!parsed.success) {
        return secureJson(
          { error: "validation", issues: parsed.error.issues },
          { status: 422, headers }
        )
      }

      const blocked = await rejectIfMemberCannotBook(actorUserId, headers)
      if (blocked) return blocked

      // The funnel page's own origin when it is an allowed Eleva origin
      // (the API host is api.*); otherwise the configured gateway.
      const origin = matchAllowedOrigin(request.headers.get("origin") ?? "")
      const base =
        origin && new URL(origin).hostname !== new URL(request.url).hostname
          ? origin
          : resolveGatewayUrl()
      const returnUrl = new URL(parsed.data.returnPath, base).toString()

      let result
      try {
        result = await createCheckoutSessionForReservation({
          reservationId: parsed.data.reservationId,
          reservationToken: parsed.data.reservationToken,
          sessionUserId: actorUserId,
          returnUrl,
        })
      } catch (err) {
        if (err instanceof BookingError) {
          return secureJson({ error: err.code }, { status: 409, headers })
        }
        console.error("[payments/checkout-session] failed", err)
        return secureJson({ error: "internal" }, { status: 500, headers })
      }

      if (!result.ok) {
        if (result.error === "not_found") {
          return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
        }
        if (result.error === "unavailable") {
          return secureJson({ error: "unavailable" }, { status: 503, headers })
        }
        const bookability = paymentIntentBookabilityStatus(result.error)
        if (bookability) {
          return secureJson(
            { error: result.error },
            { status: bookability, headers }
          )
        }
        return secureJson({ error: "internal" }, { status: 500, headers })
      }

      return secureJson(
        CreateCheckoutSessionResponseSchema.parse({
          clientSecret: result.clientSecret,
          checkoutSessionId: result.checkoutSessionId,
          bookingId: result.bookingId,
          publishableKey: result.publishableKey,
        }),
        { status: 201, headers }
      )
    }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
