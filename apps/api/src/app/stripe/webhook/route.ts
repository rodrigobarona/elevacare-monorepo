import { stripe } from "@eleva/billing/server"
import { secureJson } from "../../../lib/security-headers"

/**
 * POST /stripe/webhook
 *
 * Stripe webhook receiver. Validates the webhook signature using
 * STRIPE_WEBHOOK_SECRET and dispatches events to handlers.
 *
 * Auth model: Stripe signature verification (no session required).
 * Rate limiting: handled by Stripe's delivery rate.
 *
 * Handled events:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
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
    ReturnType<ReturnType<typeof stripe>["webhooks"]["constructEvent"]>
  >
  try {
    event = stripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature"
    console.error("[stripe-webhook] Signature verification failed:", message)
    return secureJson({ error: "invalid_signature" }, { status: 400 })
  }

  try {
    await handleEvent(event)
  } catch (err) {
    console.error(
      `[stripe-webhook] Error handling ${event.type}:`,
      err instanceof Error ? err.message : err
    )
    return secureJson({ error: "handler_error" }, { status: 500 })
  }

  return secureJson({ received: true })
}

async function handleEvent(event: {
  type: string
  data: { object: unknown }
}): Promise<void> {
  const obj = event.data.object as Record<string, unknown>

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionEvent(event.type, obj)
      break

    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(obj)
      break

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(obj)
      break

    default:
      break
  }
}

async function handleSubscriptionEvent(
  eventType: string,
  subscription: Record<string, unknown>
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : ((subscription.customer as Record<string, string>)?.id ?? "unknown")
  const tier =
    (subscription.metadata as Record<string, string>)?.eleva_tier ?? "unknown"
  const status = subscription.status as string

  console.info(
    `[stripe-webhook] ${eventType}: ${subscription.id} ` +
      `customer=${customerId} tier=${tier} status=${status}`
  )

  if (eventType === "customer.subscription.updated" && status === "past_due") {
    console.warn(
      `[stripe-webhook] Subscription ${subscription.id} is past_due. ` +
        `Customer ${customerId} may lose entitlements.`
    )
  }

  if (eventType === "customer.subscription.deleted") {
    // When a subscription is canceled, Stripe automatically removes
    // entitlements. The next access token refresh will reflect the change.
  }
}

async function handleInvoicePaymentSucceeded(
  invoice: Record<string, unknown>
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : ((invoice.customer as Record<string, string>)?.id ?? "unknown")
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : ((invoice.subscription as Record<string, string>)?.id ?? null)

  console.info(
    `[stripe-webhook] invoice.payment_succeeded: ${invoice.id} ` +
      `customer=${customerId} subscription=${subscriptionId ?? "none"} ` +
      `amount=${invoice.amount_paid}`
  )
}

async function handleInvoicePaymentFailed(
  invoice: Record<string, unknown>
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : ((invoice.customer as Record<string, string>)?.id ?? "unknown")
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : ((invoice.subscription as Record<string, string>)?.id ?? null)

  console.error(
    `[stripe-webhook] invoice.payment_failed: ${invoice.id} ` +
      `customer=${customerId} subscription=${subscriptionId ?? "none"} ` +
      `amount=${invoice.amount_due}`
  )
}
