import { captureException } from "@eleva/observability"
import { processStripeEvent, stripe } from "@eleva/billing/server"
import { secureJson } from "../../../lib/security-headers"
import { corsHeaders } from "../../../lib/cors"

/**
 * POST /webhooks/stripe
 *
 * Canonical Stripe webhook receiver. Verifies the Stripe signature against
 * STRIPE_WEBHOOK_SECRET, persists the event for idempotency, and dispatches
 * to typed handlers in `@eleva/billing/server`.
 *
 * Auth model: Stripe signature verification (no session required).
 *
 * The route handler is intentionally thin: signature verification + result
 * mapping. All business logic lives in `processStripeEvent` so the same core
 * can be invoked from tests and from QStash-driven retries.
 *
 * See `infra/stripe/setup-webhooks.ts` for the canonical event list,
 * `.cursor/rules/stripe-webhooks.mdc` for the two-file contract, and
 * ADR-016 for the subscription UX direction.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured")
    return secureJson(
      { error: "webhook_not_configured" },
      { status: 500, headers }
    )
  }

  // Initialize the Stripe SDK BEFORE the signature try block. `stripe()` calls
  // `@eleva/config.requireStripeEnv()` which throws if any of STRIPE_SECRET_KEY,
  // STRIPE_PUBLISHABLE_KEY, STRIPE_CONNECT_CLIENT_ID, or STRIPE_API_VERSION are
  // unset. Folding that throw into the signature catch (the previous bug)
  // produced the misleading "Signature verification failed" log line for what
  // was actually a missing-env-var boot failure. Distinguishing the two paths
  // is N6 from the post-merge audit.
  let stripeClient: ReturnType<typeof stripe>
  try {
    stripeClient = stripe()
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe init failed"
    console.error("[stripe-webhook] Stripe SDK init failed:", message)
    void captureException(err, { route: "/webhooks/stripe", phase: "init" })
    // 500 so Stripe retries with backoff; the operator's job is to fix the
    // missing env var, not to debug a delivery loop.
    return secureJson(
      { error: "stripe_init_failed", message },
      { status: 500, headers }
    )
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return secureJson({ error: "missing_signature" }, { status: 400, headers })
  }

  let event: Awaited<
    ReturnType<ReturnType<typeof stripe>["webhooks"]["constructEventAsync"]>
  >
  try {
    event = await stripeClient.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    )
  } catch (err) {
    // At this point the SDK is initialized, so any throw here is a genuine
    // signature problem (timestamp drift, body tampering, wrong secret).
    // Detect Stripe's named error class to keep the log honest, but treat
    // any throw as a 400 so Stripe doesn't burn retries on signature drift.
    const isSignatureError =
      err instanceof Error && err.name === "StripeSignatureVerificationError"
    const message = err instanceof Error ? err.message : "invalid signature"
    console.error(
      `[stripe-webhook] ${isSignatureError ? "Signature verification failed" : "constructEventAsync threw"}:`,
      message
    )
    return secureJson({ error: "invalid_signature" }, { status: 400, headers })
  }

  const result = await processStripeEvent(event)

  switch (result.status) {
    case "duplicate":
      console.info(
        `[stripe-webhook] Duplicate event ignored: ${result.eventId}`
      )
      return secureJson({ received: true, status: "duplicate" }, { headers })
    case "processed":
      return secureJson(
        {
          received: true,
          status: "processed",
          eventType: result.eventType,
        },
        { headers }
      )
    case "ignored":
      console.info(
        `[stripe-webhook] Ignored ${result.eventType} (${result.eventId}): ${result.reason}`
      )
      return secureJson(
        {
          received: true,
          status: "ignored",
          eventType: result.eventType,
        },
        { headers }
      )
    case "failed_terminal":
      console.error(
        `[stripe-webhook] Terminal handler failure for ${result.eventType} (${result.eventId}): ${result.error}`
      )
      return secureJson(
        {
          received: true,
          status: "failed_terminal",
          eventType: result.eventType,
          error: result.error,
        },
        { headers }
      )
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
        { status: 500, headers }
      )
  }
}
