import { logError } from "@eleva/observability"
import {
  ConfirmBookingRequestSchema,
  ConfirmBookingResponseSchema,
} from "@eleva/api-client"
import {
  retrieveBookingCheckoutSession,
  retrieveBookingPaymentIntent,
} from "@eleva/billing/server"
import {
  authorizeCheckoutSessionConfirm,
  confirmBookingPayment,
  confirmFreeReservation,
} from "@eleva/scheduling"
import { shouldAwaitDomainEventPublish } from "@eleva/workflows/should-await-domain-event-publish"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, resolveApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { checkBot } from "@/lib/bot-protection"
import { withIdempotency } from "@/lib/idempotency"
import { PUBLIC_NOT_FOUND } from "@/lib/public-marketplace"
import { publishDomainEventsNow } from "@/lib/publish-domain-events"
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
    const botVerdict = await checkBot({
      checkLevel: "deepAnalysis",
      enforceable: true,
    })
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

  const actorUserId =
    auth.type === "anonymous" ? undefined : auth.session.user.id

  return withIdempotency(
    request,
    {
      scope: "bookings.confirm",
      actor: rateLimitKey(request, actorUserId),
      headers,
    },
    async () => {
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

      let paymentIntentId = parsed.data.paymentIntentId
      let prefetchedIntent:
        | Awaited<ReturnType<typeof retrieveBookingPaymentIntent>>
        | undefined
      if (parsed.data.checkoutSessionId) {
        let authorized
        try {
          authorized = await authorizeCheckoutSessionConfirm({
            reservationId: parsed.data.reservationId,
            reservationToken: parsed.data.reservationToken,
            checkoutSessionId: parsed.data.checkoutSessionId,
            sessionUserId,
          })
        } catch (err) {
          logError("[bookings/confirm] session authorize failed", err)
          return secureJson({ error: "internal" }, { status: 500, headers })
        }
        if (!authorized) {
          return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
        }
        let checkout
        try {
          checkout = await retrieveBookingCheckoutSession(
            parsed.data.checkoutSessionId
          )
        } catch (err) {
          logError("[bookings/confirm] session retrieve failed", err)
          return secureJson({ error: "unavailable" }, { status: 503, headers })
        }
        // A session for another reservation is indistinguishable from none.
        if (!checkout || checkout.reservationId !== parsed.data.reservationId) {
          return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
        }
        if (!checkout.paymentIntentId) {
          return secureJson(
            { error: "PAYMENT_PENDING" },
            { status: 409, headers }
          )
        }
        paymentIntentId = checkout.paymentIntentId
        // Runs only after the token + bound-session check above, so there is
        // no Stripe call before authorization. The browser confirms as soon
        // as Stripe accepts the payment: an unsettled intent (MB WAY, 3DS) is
        // pending, a declined one a failure the member can retry; the
        // webhook confirms pending payments later.
        let intent
        try {
          intent = await retrieveBookingPaymentIntent(paymentIntentId)
        } catch (err) {
          logError("[bookings/confirm] intent retrieve failed", err)
          return secureJson({ error: "unavailable" }, { status: 503, headers })
        }
        if (intent.status !== "succeeded") {
          const pending =
            intent.status === "processing" ||
            intent.status === "requires_action" ||
            intent.status === "requires_confirmation" ||
            intent.status === "requires_capture"
          return secureJson(
            { error: pending ? "PAYMENT_PENDING" : "PAYMENT_FAILED" },
            { status: 409, headers }
          )
        }
        prefetchedIntent = intent
      }

      let result
      try {
        result = paymentIntentId
          ? await confirmBookingPayment({
              reservationId: parsed.data.reservationId,
              reservationToken: parsed.data.reservationToken,
              paymentIntentId,
              sessionUserId,
              source: "public",
              retrieveIntent: async (id) =>
                prefetchedIntent?.id === id
                  ? prefetchedIntent
                  : retrieveBookingPaymentIntent(id),
            })
          : await confirmFreeReservation({
              reservationId: parsed.data.reservationId,
              reservationToken: parsed.data.reservationToken,
              sessionUserId,
            })
      } catch (err) {
        logError("[bookings/confirm] failed", err)
        return secureJson({ error: "internal" }, { status: 500, headers })
      }

      if (!result.ok) {
        if (result.error === "not_found") {
          return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
        }
        if (result.error === "payment_mismatch") {
          return secureJson(
            { error: "PAYMENT_MISMATCH" },
            { status: 409, headers }
          )
        }
        if (result.error === "unavailable") {
          return secureJson({ error: "unavailable" }, { status: 503, headers })
        }
        return secureJson({ error: "internal" }, { status: 500, headers })
      }

      // The events this wrote are published once this has answered, as
      // for every request that writes one (`publish-domain-events.ts`).
      // On a laptop and in the browser tests it is waited for, so that
      // what follows (the email, the room) is there when this returns.
      if (shouldAwaitDomainEventPublish()) await publishDomainEventsNow()

      return secureJson(
        ConfirmBookingResponseSchema.parse({
          bookingId: result.bookingId,
          alreadyConfirmed: result.alreadyConfirmed,
          status: result.status,
          ...(result.approvalDeadlineAt
            ? { approvalDeadlineAt: result.approvalDeadlineAt }
            : {}),
        }),
        { status: result.alreadyConfirmed ? 200 : 201, headers }
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
