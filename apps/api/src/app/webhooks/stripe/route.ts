import { processStripeEvent, stripe } from "@eleva/billing/server"
import { secureJson } from "../../../lib/security-headers"

/**
 * POST /webhooks/stripe
 *
 * Canonical Stripe webhook receiver (Phase 1 of stripe-foundation-review).
 * Verifies the Stripe signature against STRIPE_WEBHOOK_SECRET, persists
 * the event for idempotency, and dispatches to typed handlers.
 *
 * Auth model: Stripe signature verification (no session required).
 *
 * Replaces the legacy /stripe/webhook endpoint. During cutover BOTH URLs
 * accept events and delegate to the same `processStripeEvent` core. To
 * complete the cutover:
 *
 *   1. Deploy this endpoint.
 *   2. Run `pnpm stripe:setup:webhooks -- --url <NEW_URL> --apply`.
 *   3. Verify deliveries land here with `received=true`.
 *   4. Remove the legacy /stripe/webhook route in a follow-up commit.
 *
 * See `infra/stripe/setup-webhooks.ts` for the canonical event list,
 * `.cursor/rules/stripe-webhooks.mdc` for the two-file contract, and
 * ADR-016 for the subscription UX direction.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured")
    return secureJson({ error: "webhook_not_configured" }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return secureJson({ error: "missing_signature" }, { status: 400 })
  }

  let event: Awaited<
    ReturnType<ReturnType<typeof stripe>["webhooks"]["constructEventAsync"]>
  >
  try {
    event = await stripe().webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature"
    console.error("[stripe-webhook] Signature verification failed:", message)
    return secureJson({ error: "invalid_signature" }, { status: 400 })
  }

  const result = await processStripeEvent(event)

  switch (result.status) {
    case "duplicate":
      console.info(
        `[stripe-webhook] Duplicate event ignored: ${result.eventId}`
      )
      return secureJson({ received: true, status: "duplicate" })
    case "processed":
      return secureJson({
        received: true,
        status: "processed",
        eventType: result.eventType,
      })
    case "ignored":
      console.info(
        `[stripe-webhook] Ignored ${result.eventType} (${result.eventId}): ${result.reason}`
      )
      return secureJson({
        received: true,
        status: "ignored",
        eventType: result.eventType,
      })
    case "failed":
      // Return 500 so Stripe retries with exponential backoff.
      console.error(
        `[stripe-webhook] Handler failed for ${result.eventType} (${result.eventId}): ${result.error}`
      )
      return secureJson(
        {
          received: false,
          status: "failed",
          eventType: result.eventType,
          error: result.error,
        },
        { status: 500 }
      )
  }
}
