import Stripe from "stripe"

/**
 * Creates a Stripe Customer Portal configuration for ADR-016.
 *
 * Usage:
 *   pnpm setup:portal
 *   pnpm setup:portal -- --apply
 *
 * Save the printed configuration ID as
 * STRIPE_BILLING_PORTAL_CONFIGURATION_ID in the API environment.
 */

function parseArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.slice(2).includes("--apply") }
}

async function main() {
  const { apply } = parseArgs(process.argv)
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    console.error("[stripe:portal] STRIPE_SECRET_KEY not found in environment.")
    process.exit(1)
  }

  const apiVersionRaw = process.env.STRIPE_API_VERSION ?? "2026-04-22.dahlia"
  const sdkApiVersion = apiVersionRaw as ConstructorParameters<
    typeof Stripe
  >[1] extends infer C | undefined
    ? C extends { apiVersion?: infer V }
      ? Exclude<V, undefined>
      : string
    : string

  const stripe = new Stripe(apiKey, {
    apiVersion: sdkApiVersion,
    appInfo: { name: "Eleva.care Portal Setup", version: "1.0.0" },
  })

  const returnUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://eleva.care"

  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: "Manage your Eleva subscription",
    },
    default_return_url: `${returnUrl.replace(/\/$/, "")}/account/billing`,
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["address", "tax_id"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "other",
          ],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
      },
    },
    metadata: {
      eleva_managed: "true",
      purpose: "subscription_management",
    },
  }

  console.log(
    `[stripe:portal] Mode: ${apiKey.startsWith("sk_test_") ? "TEST" : "LIVE"} | Apply: ${apply}`
  )

  if (!apply) {
    console.log("[stripe:portal] DRY-RUN - pass --apply to create.")
    console.log(JSON.stringify(params, null, 2))
    return
  }

  const config = await stripe.billingPortal.configurations.create(params)
  console.log(`[stripe:portal] Created configuration: ${config.id}`)
  console.log(
    `[stripe:portal] Set STRIPE_BILLING_PORTAL_CONFIGURATION_ID=${config.id}`
  )
}

main().catch((err) => {
  console.error("[stripe:portal] Fatal error:", err)
  process.exit(1)
})
