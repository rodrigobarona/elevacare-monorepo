/**
 * backfill-org-customers.ts
 *
 * Walks WorkOS organizations that DO NOT have stripeCustomerId set and
 * creates a Stripe Customer for each one, linking it back to the WorkOS
 * org via updateOrganization({ stripeCustomerId }). Also upserts the
 * local billing_customers mirror so the webhook handler's
 * resolveOrgIdFromCustomer lookup finds it.
 *
 * Use cases:
 * - Backfill expert/team orgs that were created via POST /organizations
 *   before W2 (provision-on-create) shipped.
 * - One-shot recovery if a provisioning call failed mid-step.
 *
 * Idempotent: re-running is a no-op for orgs that already have
 * stripeCustomerId AND a billing_customers mirror row.
 *
 * Usage:
 *   pnpm --filter @eleva/infra-stripe tsx backfill-org-customers.ts
 *   pnpm --filter @eleva/infra-stripe tsx backfill-org-customers.ts --apply
 *
 * Reads STRIPE_SECRET_KEY, WORKOS_API_KEY, DATABASE_URL from .env.local.
 */

import { eq, isNull } from "drizzle-orm"
import { WorkOS } from "@workos-inc/node"
import { provisionOrgBilling } from "@eleva/billing/server"
import { db, main as schema, withPlatformAdminContext } from "@eleva/db"

interface OrgRow {
  id: string
  workosOrgId: string
  type: "personal" | "expert" | "team" | "staff"
  name: string | null
}

async function run() {
  const apply = process.argv.includes("--apply")

  const workosApiKey = process.env.WORKOS_API_KEY
  if (!workosApiKey) {
    console.error("[backfill] WORKOS_API_KEY not set")
    process.exit(1)
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[backfill] STRIPE_SECRET_KEY not set")
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error("[backfill] DATABASE_URL not set")
    process.exit(1)
  }

  const workos = new WorkOS(workosApiKey)

  console.log(
    `[backfill] Mode: ${apply ? "APPLY" : "DRY-RUN"}\n[backfill] Loading orgs from Eleva DB...`
  )

  const orgs: OrgRow[] = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        id: schema.organizations.id,
        workosOrgId: schema.organizations.workosOrgId,
        type: schema.organizations.type,
        name: schema.organizations.slug,
      })
      .from(schema.organizations)
      // Skip soft-deleted orgs; they don't bill and don't need mirrors.
      .where(isNull(schema.organizations.deletedAt))
    return rows
  })
  console.log(`[backfill] Found ${orgs.length} live orgs\n`)

  let provisioned = 0
  let mirroredOnly = 0
  let alreadyOk = 0
  let orphan = 0
  let failed = 0

  for (const org of orgs) {
    try {
      let workosOrg
      try {
        workosOrg = await workos.organizations.getOrganization(org.workosOrgId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Orphans = local org row that no longer exists in WorkOS.
        // Likely soft-delete sync drift; skip rather than block on
        // them. The /workos/sync route will reconcile when WorkOS
        // emits the matching organization.deleted event.
        if (msg.includes("not found")) {
          orphan++
          if (!apply) {
            console.warn(
              `[backfill] ORPHAN: org ${org.id} (workos=${org.workosOrgId}) does not exist in WorkOS - skipping`
            )
          }
          continue
        }
        throw err
      }
      const hasMirror = await checkMirrorExists(org.id)

      if (workosOrg.stripeCustomerId && hasMirror) {
        alreadyOk++
        continue
      }

      if (!apply) {
        if (!workosOrg.stripeCustomerId) {
          console.log(
            `[backfill] DRY: would provision Stripe customer for org ${org.id} (workos=${org.workosOrgId}, type=${org.type})`
          )
          provisioned++
        } else {
          console.log(
            `[backfill] DRY: would write billing_customers mirror for org ${org.id} (existing customer ${workosOrg.stripeCustomerId})`
          )
          mirroredOnly++
        }
        continue
      }

      const result = await provisionOrgBilling({
        orgId: org.id,
        workosOrgId: org.workosOrgId,
        orgName: org.name ?? `org-${org.id.slice(0, 8)}`,
        orgType: org.type,
        actorUserId: null,
      })

      if (result.customerCreated) {
        provisioned++
        console.log(
          `[backfill] Provisioned ${result.stripeCustomerId} for org ${org.id}`
        )
      } else {
        mirroredOnly++
        console.log(
          `[backfill] Mirrored ${result.stripeCustomerId} for org ${org.id}`
        )
      }
    } catch (err) {
      failed++
      console.error(
        `[backfill] FAILED for org ${org.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  console.log("\n[backfill] Summary:")
  console.log(`  Already OK: ${alreadyOk}`)
  console.log(`  Provisioned (new customer): ${provisioned}`)
  console.log(`  Mirrored only (existing customer): ${mirroredOnly}`)
  console.log(`  Orphan (deleted in WorkOS): ${orphan}`)
  console.log(`  Failed: ${failed}`)
  if (!apply) {
    console.log("\n[backfill] DRY-RUN complete. Re-run with --apply to commit.")
  }
  if (orphan > 0) {
    console.log(
      "\n[backfill] Orphans should be reconciled via /workos/sync - they correspond to deleted WorkOS orgs."
    )
  }
}

async function checkMirrorExists(orgId: string): Promise<boolean> {
  // Use platform-admin context because this script runs outside any
  // tenant request lifecycle.
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

// Touch the imports to satisfy unused-var checks in CI.
void db

run().catch((err) => {
  console.error("[backfill] Fatal:", err)
  process.exit(1)
})
