import { neon } from "@neondatabase/serverless"
import Stripe from "stripe"

/**
 * verify-entitlements — compare Stripe's diagnostic active-entitlements
 * API against the local billing_customers mirror for an org.
 *
 * Canonical runtime path:
 *   Stripe subscription -> billing mirrors -> session.entitlements -> @eleva/flags
 *
 * Usage:
 *   pnpm stripe:verify:entitlements -- --org-id <local_org_uuid>
 *   pnpm stripe:verify:entitlements -- --org-id <uuid> --no-stripe-api
 *
 * Required env:
 *   DATABASE_URL
 *   STRIPE_SECRET_KEY (unless --no-stripe-api is used)
 */

interface Args {
  orgId?: string
  includeStripeApi: boolean
}

interface BillingCustomerRow {
  org_id: string
  stripe_customer_id: string
  slug: string | null
}

interface QueryClient {
  query: (query: string, params?: unknown[]) => Promise<unknown>
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2)
  const parsed: Args = { includeStripeApi: !args.includes("--no-stripe-api") }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--org-id") parsed.orgId = args[++i]
  }

  if (!parsed.orgId) {
    console.error("[verify-entitlements] Missing required --org-id <uuid>.")
    process.exit(1)
  }

  return parsed
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[verify-entitlements] ${name} is not set`)
    process.exit(1)
  }
  return value
}

async function findBillingCustomer(
  sql: QueryClient,
  orgId: string
): Promise<BillingCustomerRow | null> {
  const rows = await sql.query(
    `SELECT bc.org_id, bc.stripe_customer_id, o.slug
     FROM billing_customers bc
     LEFT JOIN auth.organization o ON o.id = bc.org_id
     WHERE bc.org_id = $1
     LIMIT 1`,
    [orgId]
  )

  return (rows as BillingCustomerRow[])[0] ?? null
}

async function main() {
  const args = parseArgs(process.argv)
  const databaseUrl = requireEnv("DATABASE_URL")

  const sql = neon(databaseUrl)
  const billingCustomer = await findBillingCustomer(sql, args.orgId!)
  if (!billingCustomer) {
    console.error(
      "[verify-entitlements] No billing_customers row found for the provided org."
    )
    process.exit(1)
  }

  console.log("Entitlement verification")
  console.log("========================")
  console.log(`  Local org:       ${billingCustomer.org_id}`)
  console.log(`  Org slug:        ${billingCustomer.slug ?? "(none)"}`)
  console.log(`  Stripe customer: ${billingCustomer.stripe_customer_id}`)

  if (args.includeStripeApi) {
    const stripeKey = requireEnv("STRIPE_SECRET_KEY")
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2026-04-22.dahlia",
      appInfo: { name: "Eleva.care Entitlement Verifier", version: "1.0.0" },
    })

    console.log("\nStripe Entitlements API")
    console.log("-----------------------")
    const active = await stripe.entitlements.activeEntitlements.list({
      customer: billingCustomer.stripe_customer_id,
      limit: 20,
    })
    console.log(`  count: ${active.data.length}`)
    if (active.data.length > 0) {
      for (const entitlement of active.data) {
        console.log(
          `  - lookup_key=${entitlement.lookup_key} feature=${entitlement.feature}`
        )
      }
    }
  }
}

main().catch((err) => {
  console.error("[verify-entitlements] Fatal:", err)
  process.exit(1)
})
