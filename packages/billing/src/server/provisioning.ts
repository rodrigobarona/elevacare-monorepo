import { eq } from "drizzle-orm"
import { WorkOS } from "@workos-inc/node"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import { createOrgCustomer, createOrgSubscription } from "./subscriptions"
import { stripe } from "./client"
import type { ProductTier } from "./subscriptions"

/**
 * Maps Eleva org types to their default subscription tier.
 * Every org gets a subscription from day one.
 */
const ORG_TYPE_TO_TIER: Record<string, ProductTier> = {
  personal: "member_free",
  expert: "expert_community",
  team: "clinic_starter",
  staff: "member_free",
}

let workosInstance: WorkOS | null = null

function getWorkOS(): WorkOS {
  if (workosInstance) return workosInstance
  const apiKey = process.env.WORKOS_API_KEY
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY is required for billing provisioning")
  }
  workosInstance = new WorkOS(apiKey)
  return workosInstance
}

export interface ProvisionBillingInput {
  orgId: string
  workosOrgId: string
  orgName: string
  orgType: string
  /** Acting user (used for the audit row's actor_user_id). */
  actorUserId?: string | null
  email?: string
}

export interface ProvisionBillingResult {
  stripeCustomerId: string
  subscriptionId: string | null
  /** True when the Stripe Customer was newly created in this call. */
  customerCreated: boolean
}

/**
 * Provisions Stripe billing for a new organization:
 * 1. Creates a Stripe Customer (idempotent: reuses existing one).
 * 2. Sets `stripeCustomerId` on the WorkOS organization (so the
 *    WorkOS Stripe Add-on can attach entitlements to the org).
 * 3. Upserts the local `billing_customers` mirror row under withAudit
 *    (so the webhook's `resolveOrgIdFromCustomer` lookup finds it
 *    without round-tripping WorkOS or Stripe).
 * 4. Creates a free-tier subscription so entitlements flow from day one.
 *
 * Should be called after the org is created in both WorkOS and Eleva DB.
 * Idempotent: handles partial failures by checking existing state at
 * each step. Safe to re-run via the `backfill-org-customers.ts` script.
 */
export async function provisionOrgBilling(
  input: ProvisionBillingInput
): Promise<ProvisionBillingResult> {
  const workos = getWorkOS()

  const existingOrg = await workos.organizations.getOrganization(
    input.workosOrgId
  )

  let stripeCustomerId = existingOrg.stripeCustomerId
  let customerCreated = false

  if (stripeCustomerId) {
    await ensureBillingCustomerMirror({
      orgId: input.orgId,
      workosOrgId: input.workosOrgId,
      stripeCustomerId,
      actorUserId: input.actorUserId ?? null,
    })
    const subscriptionId = await ensureSubscriptionExists({
      customerId: stripeCustomerId,
      orgType: input.orgType,
      orgId: input.orgId,
    })
    return { stripeCustomerId, subscriptionId, customerCreated }
  }

  const customer = await createOrgCustomer({
    orgName: input.orgName,
    orgId: input.orgId,
    workosOrgId: input.workosOrgId,
    email: input.email,
  })

  stripeCustomerId = customer.id
  customerCreated = true

  await workos.organizations.updateOrganization({
    organization: input.workosOrgId,
    stripeCustomerId,
  })

  await ensureBillingCustomerMirror({
    orgId: input.orgId,
    workosOrgId: input.workosOrgId,
    stripeCustomerId,
    actorUserId: input.actorUserId ?? null,
  })

  const tier = ORG_TYPE_TO_TIER[input.orgType] ?? "member_free"
  let subscriptionId: string | null = null
  try {
    const subscription = await createOrgSubscription({
      customerId: stripeCustomerId,
      tier,
      orgId: input.orgId,
    })
    subscriptionId = subscription?.id ?? null
  } catch (err) {
    console.error(
      `[provisioning] Subscription creation failed for customer ${stripeCustomerId}:`,
      err instanceof Error ? err.message : err
    )
  }

  return { stripeCustomerId, subscriptionId, customerCreated }
}

/**
 * Idempotent upsert of the local `billing_customers` mirror. On insert
 * emits a `billing_customer.created` audit row. On update (existing
 * row), this is a no-op; we only need the mirror to exist so the
 * webhook can resolve org_id from a Stripe customer id.
 */
async function ensureBillingCustomerMirror(input: {
  orgId: string
  workosOrgId: string
  stripeCustomerId: string
  actorUserId: string | null
}): Promise<void> {
  // Cheap pre-check under platform-admin context to avoid an audit-row
  // emit on every provisioning rerun.
  const existing = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({ id: main.billingCustomers.id })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, input.orgId))
      .limit(1)
    return rows[0] ?? null
  })
  if (existing) return

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await insertBillingCustomerRow(tx, input)
      await ctx.emit({
        entity: "billing_customer",
        action: "created",
        entityId: input.stripeCustomerId,
        payload: {
          stripeCustomerId: input.stripeCustomerId,
          workosOrgId: input.workosOrgId,
        },
      })
    }
  )
}

async function insertBillingCustomerRow(
  tx: Tx,
  input: {
    orgId: string
    workosOrgId: string
    stripeCustomerId: string
  }
): Promise<void> {
  await tx
    .insert(main.billingCustomers)
    .values({
      orgId: input.orgId,
      workosOrgId: input.workosOrgId,
      stripeCustomerId: input.stripeCustomerId,
    })
    .onConflictDoNothing({ target: main.billingCustomers.orgId })
}

/**
 * Validates that an active subscription exists for the customer.
 * If missing, creates the default tier subscription.
 */
async function ensureSubscriptionExists(input: {
  customerId: string
  orgType: string
  orgId: string
}): Promise<string | null> {
  const s = stripe()
  const subscriptions = await s.subscriptions.list({
    customer: input.customerId,
    limit: 5,
  })

  const activeSub = subscriptions.data.find((sub) =>
    ["active", "trialing", "incomplete"].includes(sub.status)
  )

  if (activeSub) {
    return activeSub.id
  }

  const tier = ORG_TYPE_TO_TIER[input.orgType] ?? "member_free"
  const subscription = await createOrgSubscription({
    customerId: input.customerId,
    tier,
    orgId: input.orgId,
  })
  return subscription?.id ?? null
}
