/**
 * backfill-org-customers.ts
 *
 * Walks Better Auth organizations that do not yet have a
 * billing_customers mirror and provisions a Stripe Customer for each.
 *
 * Usage:
 *   pnpm --filter @eleva/infra-stripe tsx backfill-org-customers.ts
 *   pnpm --filter @eleva/infra-stripe tsx backfill-org-customers.ts --apply
 */

import { eq } from "drizzle-orm"
import { provisionOrgBilling } from "@eleva/billing/server"
import { auth, db, main as schema, withPlatformAdminContext } from "@eleva/db"

interface OrgRow {
  id: string
  type: string
  name: string
}

async function run() {
  const apply = process.argv.includes("--apply")

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[backfill] STRIPE_SECRET_KEY not set")
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error("[backfill] DATABASE_URL not set")
    process.exit(1)
  }

  console.log(
    `[backfill] Mode: ${apply ? "APPLY" : "DRY-RUN"}\n[backfill] Loading orgs from auth.organization...`
  )

  const orgs: OrgRow[] = await withPlatformAdminContext(async (tx) => {
    return tx
      .select({
        id: auth.organization.id,
        type: auth.organization.type,
        name: auth.organization.name,
      })
      .from(auth.organization)
  })
  console.log(`[backfill] Found ${orgs.length} orgs\n`)

  let provisioned = 0
  let wouldProvision = 0
  let alreadyOk = 0
  let failed = 0

  for (const org of orgs) {
    try {
      const hasMirror = await checkMirrorExists(org.id)
      if (hasMirror) {
        alreadyOk++
        continue
      }

      if (!apply) {
        console.log(
          `[backfill] DRY: would provision Stripe customer for org ${org.id} (${org.type})`
        )
        wouldProvision++
        continue
      }

      const result = await provisionOrgBilling({
        orgId: org.id,
        orgName: org.name,
        orgType: org.type,
        actorUserId: null,
      })

      provisioned++
      console.log(
        `[backfill] Provisioned ${result.stripeCustomerId} for org ${org.id}`
      )
    } catch (err) {
      failed++
      console.error(
        `[backfill] FAILED for org ${org.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  console.log("\n[backfill] Summary:")
  console.log(`  Already OK: ${alreadyOk}`)
  console.log(`  Provisioned: ${provisioned}`)
  console.log(`  Would provision: ${wouldProvision}`)
  console.log(`  Failed: ${failed}`)
  if (!apply) {
    console.log("\n[backfill] DRY-RUN complete. Re-run with --apply to commit.")
  }
}

async function checkMirrorExists(orgId: string): Promise<boolean> {
  const result = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({ id: schema.billingCustomers.id })
      .from(schema.billingCustomers)
      .where(eq(schema.billingCustomers.orgId, orgId))
      .limit(1)
    return rows[0] ?? null
  })
  return result !== null
}

void db

run().catch((err) => {
  console.error("[backfill] Fatal:", err)
  process.exit(1)
})
