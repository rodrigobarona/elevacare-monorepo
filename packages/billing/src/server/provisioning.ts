import { WorkOS } from "@workos-inc/node"
import { createOrgCustomer, createOrgSubscription } from "./subscriptions"
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
 * Idempotent: if the WorkOS org already has a stripeCustomerId, returns early.
 */
export async function provisionOrgBilling(
  input: ProvisionBillingInput
): Promise<ProvisionBillingResult> {
  const workos = getWorkOS()

  const existingOrg = await workos.organizations.getOrganization(
    input.workosOrgId
  )
  if (existingOrg.stripeCustomerId) {
    return {
      stripeCustomerId: existingOrg.stripeCustomerId,
      subscriptionId: null,
    }
  }

  const customer = await createOrgCustomer({
    orgName: input.orgName,
    orgId: input.orgId,
    workosOrgId: input.workosOrgId,
    email: input.email,
  })

  await workos.organizations.updateOrganization({
    organization: input.workosOrgId,
    stripeCustomerId: customer.id,
  })

  const tier = ORG_TYPE_TO_TIER[input.orgType] ?? "member_free"
  const subscription = await createOrgSubscription({
    customerId: customer.id,
    tier,
  })

  return {
    stripeCustomerId: customer.id,
    subscriptionId: subscription?.id ?? null,
  }
}
