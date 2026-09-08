import { eq } from "drizzle-orm"
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
  academy: "member_free",
  staff: "member_free",
}

export interface ProvisionBillingInput {
  orgId: string
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
 * 1. Creates a Stripe Customer (idempotent: reuses existing mirror).
 * 2. Upserts the local `billing_customers` row under withAudit.
 * 3. Creates a free-tier subscription so entitlements flow from day one.
 */
export async function provisionOrgBilling(
  input: ProvisionBillingInput
): Promise<ProvisionBillingResult> {
  const existing = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        stripeCustomerId: main.billingCustomers.stripeCustomerId,
      })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, input.orgId))
      .limit(1)
    return rows[0] ?? null
  })

  if (existing) {
    let subscriptionId: string | null = null
    try {
      subscriptionId = await ensureSubscriptionExists({
        customerId: existing.stripeCustomerId,
        orgType: input.orgType,
        orgId: input.orgId,
      })
    } catch (err) {
      console.error(
        `[provisioning] ensureSubscriptionExists failed for customer ${existing.stripeCustomerId}:`,
        err instanceof Error ? err.message : err
      )
    }
    return {
      stripeCustomerId: existing.stripeCustomerId,
      subscriptionId,
      customerCreated: false,
    }
  }

  const customer = await createOrgCustomer({
    orgName: input.orgName,
    orgId: input.orgId,
    email: input.email,
  })

  await ensureBillingCustomerMirror({
    orgId: input.orgId,
    stripeCustomerId: customer.id,
    actorUserId: input.actorUserId ?? null,
  })

  const canonical = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        stripeCustomerId: main.billingCustomers.stripeCustomerId,
      })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, input.orgId))
      .limit(1)
    return rows[0] ?? null
  })
  const stripeCustomerId = canonical?.stripeCustomerId ?? customer.id
  if (stripeCustomerId !== customer.id) {
    console.warn(
      `[provisioning] mirror race for org ${input.orgId}: created ${customer.id} but canonical is ${stripeCustomerId}; orphaned customer requires cleanup`
    )
  }

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

  return {
    stripeCustomerId,
    subscriptionId,
    customerCreated: stripeCustomerId === customer.id,
  }
}

async function ensureBillingCustomerMirror(input: {
  orgId: string
  stripeCustomerId: string
  actorUserId: string | null
}): Promise<void> {
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
        },
      })
    }
  )
}

async function insertBillingCustomerRow(
  tx: Tx,
  input: {
    orgId: string
    stripeCustomerId: string
  }
): Promise<void> {
  await tx
    .insert(main.billingCustomers)
    .values({
      orgId: input.orgId,
      stripeCustomerId: input.stripeCustomerId,
    })
    .onConflictDoNothing({ target: main.billingCustomers.orgId })
}

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
