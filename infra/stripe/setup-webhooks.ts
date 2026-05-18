import Stripe from "stripe"

/**
 * setup-webhooks — creates or updates the Stripe webhook endpoint that
 * receives Eleva platform events. Idempotent: if an endpoint with the
 * same URL already exists, its enabled_events list is synced to the
 * canonical set.
 *
 * Canonical endpoint URL: https://api.eleva.care/webhooks/stripe
 *
 * Usage:
 *   pnpm setup:webhooks -- --url https://api.eleva.care/webhooks/stripe
 *   pnpm setup:webhooks -- --url https://api.eleva.care/webhooks/stripe --apply
 *
 * The signing secret (whsec_...) is only returned on creation. Save it
 * immediately as STRIPE_WEBHOOK_SECRET in your environment.
 *
 * For local development, use the Stripe CLI instead:
 *   stripe listen --forward-to localhost:3002/webhooks/stripe
 *
 * Uses STRIPE_SECRET_KEY from .env.local (staging by default).
 *
 * Note: the WorkOS Stripe Add-on does NOT support Stripe Sandbox
 * accounts (per ADR-016). For staging/dev, use Stripe test mode on a
 * standard account, not a Sandbox account.
 */

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  // SaaS subscription lifecycle.
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  // invoice.payment_succeeded is a Stripe-emitted alias for invoice.paid
  // that older integrations still rely on; Eleva subscribes to both for
  // robustness and the dispatcher routes them through the same handler.
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  // Stripe Identity (expert KYC).
  "identity.verification_session.verified",
  "identity.verification_session.requires_input",
  "identity.verification_session.canceled",
  // Stripe Connect platform (expert / clinic accounts).
  "account.updated",
  "capability.updated",
  "account.application.deauthorized",
  // Connect payouts (expert payouts on the connected account).
  "payout.paid",
  "payout.failed",
  // Booking PaymentIntents (patient checkout).
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  // Refunds and disputes (booking payments).
  "charge.refunded",
  "charge.dispute.created",
]

function parseArgs(argv: string[]): { url: string | null; apply: boolean } {
  const args = argv.slice(2)
  const apply = args.includes("--apply")
  const urlIndex = args.indexOf("--url")
  const url = urlIndex !== -1 ? (args[urlIndex + 1] ?? null) : null
  return { url, apply }
}

async function findExistingEndpoint(
  stripe: Stripe,
  url: string
): Promise<Stripe.WebhookEndpoint | null> {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  return endpoints.data.find((ep) => ep.url === url) ?? null
}

function eventsMatch(existing: string[], desired: readonly string[]): boolean {
  if (existing.length !== desired.length) return false
  const sorted = [...existing].sort()
  const desiredSorted = [...desired].sort()
  return sorted.every((e, i) => e === desiredSorted[i])
}

async function main() {
  const { url, apply } = parseArgs(process.argv)

  if (!url) {
    console.error(
      "[stripe:webhooks] Missing --url argument.\n" +
        "  Usage: pnpm setup:webhooks -- --url https://api.eleva.care/webhooks/stripe [--apply]"
    )
    process.exit(1)
  }

  try {
    new URL(url)
  } catch {
    console.error(`[stripe:webhooks] Invalid URL: ${url}`)
    process.exit(1)
  }

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    console.error(
      "[stripe:webhooks] STRIPE_SECRET_KEY not found in environment."
    )
    process.exit(1)
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: "2026-04-22.dahlia",
    appInfo: { name: "Eleva.care Webhook Setup", version: "1.0.0" },
  })

  const isTestMode = apiKey.startsWith("sk_test_")
  console.log(
    `[stripe:webhooks] Mode: ${isTestMode ? "TEST" : "LIVE"} | Apply: ${apply}\n`
  )

  if (!apply) {
    console.log("[stripe:webhooks] DRY-RUN — pass --apply to configure.\n")
    console.log(`  Endpoint URL: ${url}`)
    console.log("  Events:")
    for (const event of WEBHOOK_EVENTS) {
      console.log(`    - ${event}`)
    }
    console.log()
    return
  }

  const existing = await findExistingEndpoint(stripe, url)

  if (existing) {
    if (eventsMatch(existing.enabled_events, WEBHOOK_EVENTS)) {
      console.log(
        `[stripe:webhooks] Endpoint already exists and events are in sync (${existing.id})`
      )
      console.log(`  URL: ${existing.url}`)
      console.log(`  Status: ${existing.status}`)
      console.log(
        "\n[stripe:webhooks] No changes needed. The signing secret was shown at creation time only."
      )
      return
    }

    const updated = await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: [...WEBHOOK_EVENTS],
    })
    console.log(`[stripe:webhooks] Updated endpoint: ${updated.id}`)
    console.log(`  URL: ${updated.url}`)
    console.log("  Synced events:")
    for (const event of WEBHOOK_EVENTS) {
      console.log(`    - ${event}`)
    }
    console.log(
      "\n[stripe:webhooks] Events updated. The signing secret was shown at creation time only."
    )
    return
  }

  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: [...WEBHOOK_EVENTS],
    description:
      "Eleva platform events (SaaS subs, invoices, Identity, Connect, payouts, booking payments)",
  })

  console.log(`[stripe:webhooks] Created endpoint: ${created.id}`)
  console.log(`  URL: ${created.url}`)
  console.log("  Events:")
  for (const event of WEBHOOK_EVENTS) {
    console.log(`    - ${event}`)
  }
  console.log(`\n[stripe:webhooks] Signing secret: ${created.secret}`)
  console.log(
    "[stripe:webhooks] IMPORTANT: Save this secret now — it cannot be retrieved later."
  )
  console.log(
    `[stripe:webhooks] Set STRIPE_WEBHOOK_SECRET=${created.secret} in your environment.`
  )
}

main().catch((err) => {
  console.error("[stripe:webhooks] Fatal error:", err)
  process.exit(1)
})
