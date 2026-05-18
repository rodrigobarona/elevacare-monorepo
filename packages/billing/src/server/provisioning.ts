import { WorkOS } from "@workos-inc/node"
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
  email?: string
}

export interface ProvisionBillingResult {
  stripeCustomerId: string
  subscriptionId: string | null
}

/**
 * Provisions Stripe billing for a new organization:
 * 1. Creates a Stripe Customer
 * 2. Sets stripeCustomerId on the WorkOS organization
 * 3. Creates a free-tier subscription (so entitlements flow from day one)
 *
 * Should be called after the org is created in both WorkOS and Eleva DB.
 * Idempotent: handles partial failures by checking existing state at each step.
 */
export async function provisionOrgBilling(
  input: ProvisionBillingInput
): Promise<ProvisionBillingResult> {
  const workos = getWorkOS()

  const existingOrg = await workos.organizations.getOrganization(
    input.workosOrgId
  )

  let stripeCustomerId = existingOrg.stripeCustomerId

  if (stripeCustomerId) {
    const subscriptionId = await ensureSubscriptionExists(
      stripeCustomerId,
      input.orgType
    )
    return { stripeCustomerId, subscriptionId }
  }

  const customer = await createOrgCustomer({
    orgName: input.orgName,
    orgId: input.orgId,
    workosOrgId: input.workosOrgId,
    email: input.email,
  })

  stripeCustomerId = customer.id

  await workos.organizations.updateOrganization({
    organization: input.workosOrgId,
    stripeCustomerId,
  })

  const tier = ORG_TYPE_TO_TIER[input.orgType] ?? "member_free"
  let subscriptionId: string | null = null
  try {
    const subscription = await createOrgSubscription({
      customerId: stripeCustomerId,
      tier,
    })
    subscriptionId = subscription?.id ?? null
  } catch (err) {
    console.error(
      `[provisioning] Subscription creation failed for customer ${stripeCustomerId}:`,
      err instanceof Error ? err.message : err
    )
  }

  return { stripeCustomerId, subscriptionId }
}

/**
 * Validates that an active subscription exists for the customer.
 * If missing, creates the default tier subscription.
 */
async function ensureSubscriptionExists(
  customerId: string,
  orgType: string
): Promise<string | null> {
  const s = stripe()
  const subscriptions = await s.subscriptions.list({
    customer: customerId,
    limit: 5,
  })

  const activeSub = subscriptions.data.find((sub) =>
    ["active", "trialing", "incomplete"].includes(sub.status)
  )

  if (activeSub) {
    return activeSub.id
  }

  const tier = ORG_TYPE_TO_TIER[orgType] ?? "member_free"
  const subscription = await createOrgSubscription({
    customerId,
    tier,
  })
  return subscription?.id ?? null
}
