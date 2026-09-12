import type Stripe from "stripe"

/**
 * Canonical Stripe webhook event lists (Phase 06.2).
 *
 * Two endpoints per environment:
 *   - `/webhooks/stripe` — platform account (`STRIPE_WEBHOOK_SECRET`)
 *   - `/webhooks/stripe/connect` — connected accounts (`connect: true`,
 *     `STRIPE_CONNECT_WEBHOOK_SECRET`)
 *
 * `WEBHOOK_EVENTS` is the union the dispatcher must handle. Setup script
 * and dispatcher share this module so they cannot drift.
 */

export const PLATFORM_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "identity.verification_session.verified",
  "identity.verification_session.requires_input",
  "identity.verification_session.canceled",
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.closed",
  "transfer.created",
  "transfer.updated",
  "transfer.reversed",
] as const satisfies readonly Stripe.WebhookEndpointCreateParams.EnabledEvent[]

export const CONNECT_WEBHOOK_EVENTS = [
  "account.updated",
  "capability.updated",
  "account.application.deauthorized",
  "payout.paid",
  "payout.failed",
] as const satisfies readonly Stripe.WebhookEndpointCreateParams.EnabledEvent[]

export const WEBHOOK_EVENTS = [
  ...PLATFORM_WEBHOOK_EVENTS,
  ...CONNECT_WEBHOOK_EVENTS,
] as const satisfies readonly Stripe.WebhookEndpointCreateParams.EnabledEvent[]

export type PlatformWebhookEvent = (typeof PLATFORM_WEBHOOK_EVENTS)[number]
export type ConnectWebhookEvent = (typeof CONNECT_WEBHOOK_EVENTS)[number]
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number]
