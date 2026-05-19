import { neon } from "@neondatabase/serverless"
import { WorkOS } from "@workos-inc/node"
import Stripe from "stripe"

/**
 * verify-entitlements — compare the canonical WorkOS JWT entitlement
 * claim with Stripe's diagnostic active-entitlements API for an org.
 *
 * Canonical runtime path:
 *   WorkOS access token JWT -> session.entitlements -> @eleva/flags
 *
 * The Stripe Entitlements API is useful for diagnosis, but the app does
 * NOT call `customers.activeEntitlements.list()` at runtime. If the Stripe
 * API returns zero entitlements in Sandbox while the JWT claim is correct,
 * the app is still healthy.
 *
 * Usage:
 *   pnpm stripe:verify:entitlements -- --org-id <local_org_uuid>
 *   pnpm stripe:verify:entitlements -- --workos-org-id org_xxx
 *   pnpm stripe:verify:entitlements -- --org-id <uuid> --access-token <jwt>
 *   pnpm stripe:verify:entitlements -- --org-id <uuid> --no-stripe-api
 *
 * Required env:
 *   DATABASE_URL, WORKOS_API_KEY, STRIPE_SECRET_KEY
 *
 * Notes:
 * - This script cannot mint a user's interactive AuthKit access token. Pass
 *   `--access-token` copied from a signed-in browser session when you want
 *   to inspect the actual JWT claim.
 * - Do not paste access tokens into shared logs. This script prints only
 *   decoded claim values, never the token itself.
 */

interface Args {
  orgId?: string
  workosOrgId?: string
  accessToken?: string
  includeStripeApi: boolean
}

interface BillingCustomerRow {
  org_id: string
  workos_org_id: string
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
    if (arg === "--workos-org-id") parsed.workosOrgId = args[++i]
    if (arg === "--access-token") parsed.accessToken = args[++i]
  }

  if (!parsed.orgId && !parsed.workosOrgId) {
    console.error(
      "[verify-entitlements] Missing required --org-id <uuid> or --workos-org-id <org_xxx>."
    )
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

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".")
  if (!payload) throw new Error("access token is not a JWT")

  const padded = payload.padEnd(
    payload.length + ((4 - (payload.length % 4)) % 4),
    "="
  )
  return JSON.parse(
    Buffer.from(padded, "base64url").toString("utf8")
  ) as Record<string, unknown>
}

async function findBillingCustomer(
  sql: QueryClient,
  args: Args
): Promise<BillingCustomerRow | null> {
  const rows = args.orgId
    ? await sql.query(
        `SELECT bc.org_id, bc.workos_org_id, bc.stripe_customer_id, o.slug
         FROM billing_customers bc
         LEFT JOIN organizations o ON o.id = bc.org_id
         WHERE bc.org_id = $1
         LIMIT 1`,
        [args.orgId]
      )
    : await sql.query(
        `SELECT bc.org_id, bc.workos_org_id, bc.stripe_customer_id, o.slug
         FROM billing_customers bc
         LEFT JOIN organizations o ON o.id = bc.org_id
         WHERE bc.workos_org_id = $1
         LIMIT 1`,
        [args.workosOrgId]
      )

  return (rows as BillingCustomerRow[])[0] ?? null
}

async function main() {
  const args = parseArgs(process.argv)
  const databaseUrl = requireEnv("DATABASE_URL")
  const workosKey = requireEnv("WORKOS_API_KEY")

  const sql = neon(databaseUrl)
  const workos = new WorkOS(workosKey)

  const billingCustomer = await findBillingCustomer(sql, args)
  if (!billingCustomer) {
    console.error(
      "[verify-entitlements] No billing_customers row found for the provided org."
    )
    process.exit(1)
  }

  console.log("Entitlement verification")
  console.log("========================")
  console.log(`  Local org:       ${billingCustomer.org_id}`)
  console.log(`  WorkOS org:      ${billingCustomer.workos_org_id}`)
  console.log(`  Org slug:        ${billingCustomer.slug ?? "(none)"}`)
  console.log(`  Stripe customer: ${billingCustomer.stripe_customer_id}`)

  const workosOrg = await workos.organizations.getOrganization(
    billingCustomer.workos_org_id
  )
  console.log(
    `  WorkOS stripeCustomerId: ${workosOrg.stripeCustomerId ?? "(none)"}`
  )
  console.log(
    `  WorkOS customer link:   ${
      workosOrg.stripeCustomerId === billingCustomer.stripe_customer_id
        ? "MATCH"
        : "MISMATCH"
    }`
  )

  if (args.accessToken) {
    const payload = decodeJwtPayload(args.accessToken)
    const entitlements = payload.entitlements
    const orgId = payload.org_id
    console.log("\nWorkOS access-token claims (canonical runtime path)")
    console.log("--------------------------------------------------")
    console.log(`  org_id:       ${String(orgId ?? "(missing)")}`)
    console.log(
      `  entitlements: ${Array.isArray(entitlements) ? entitlements.join(", ") || "(empty)" : "(missing)"}`
    )
  } else {
    console.log("\nWorkOS access-token claims (canonical runtime path)")
    console.log("--------------------------------------------------")
    console.log(
      "  Skipped: pass --access-token <jwt> from a signed-in browser session to inspect the actual claim."
    )
  }

  if (args.includeStripeApi) {
    const stripeKey = requireEnv("STRIPE_SECRET_KEY")
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2026-04-22.dahlia",
      appInfo: { name: "Eleva.care Entitlement Verifier", version: "1.0.0" },
    })

    console.log("\nStripe Entitlements API (diagnostic comparison only)")
    console.log("----------------------------------------------------")
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
