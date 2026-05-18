import type Stripe from "stripe"
import { stripe } from "./client"

/**
 * Stripe product metadata keys used to identify Eleva subscription tiers.
 * These match the keys seeded by infra/stripe/seed-products.ts.
 */
export const PRODUCT_KEYS = {
  member_free: "eleva_member_free",
  expert_community: "eleva_expert_community",
  expert_top: "eleva_expert_top",
  clinic_starter: "eleva_clinic_starter",
  clinic_growth: "eleva_clinic_growth",
} as const

export type ProductTier = keyof typeof PRODUCT_KEYS

/**
 * Creates a Stripe Customer for an Eleva organization.
 * This customer is then linked to the WorkOS organization via stripeCustomerId.
 */
export async function createOrgCustomer(input: {
  orgName: string
  orgId: string
  workosOrgId: string
  email?: string
}): Promise<Stripe.Customer> {
  return stripe().customers.create({
    name: input.orgName,
    email: input.email,
    metadata: {
      eleva_org_id: input.orgId,
      workos_org_id: input.workosOrgId,
    },
  })
}

/**
 * Finds the default price for a given product tier.
 * Searches products by metadata key and returns the first active monthly price.
 */
export async function findTierPrice(tier: ProductTier): Promise<string | null> {
  const metadataKey = PRODUCT_KEYS[tier]
  const products = await stripe().products.search({
    query: `metadata["eleva_product_key"]:"${metadataKey}"`,
  })

  const product = products.data[0]
  if (!product) return null

  const prices = await stripe().prices.list({
    product: product.id,
    active: true,
    type: "recurring",
    limit: 5,
  })

  const basePrice = prices.data.find(
    (p) => p.metadata.eleva_price_type === "base"
  )
  return basePrice?.id ?? prices.data[0]?.id ?? null
}

/**
 * Creates a subscription for an org on the given tier.
 * Used during provisioning to give every org a subscription from day one.
 */
export async function createOrgSubscription(input: {
  customerId: string
  tier: ProductTier
  quantity?: number
}): Promise<Stripe.Subscription | null> {
  const priceId = await findTierPrice(input.tier)
  if (!priceId) return null

  return stripe().subscriptions.create({
    customer: input.customerId,
    items: [{ price: priceId, quantity: input.quantity ?? 1 }],
    metadata: {
      eleva_tier: input.tier,
    },
  })
}

/**
 * Swaps an existing subscription to a different tier.
 * Used for upgrades (Expert Community -> Top Expert) and clinic tier changes.
 */
export async function swapSubscriptionTier(input: {
  subscriptionId: string
  newTier: ProductTier
  quantity?: number
}): Promise<Stripe.Subscription | null> {
  const newPriceId = await findTierPrice(input.newTier)
  if (!newPriceId) return null

  const subscription = await stripe().subscriptions.retrieve(
    input.subscriptionId
  )
  const currentItem = subscription.items.data[0]
  if (!currentItem) return null

  return stripe().subscriptions.update(input.subscriptionId, {
    items: [
      {
        id: currentItem.id,
        price: newPriceId,
        quantity: input.quantity ?? 1,
      },
    ],
    metadata: {
      eleva_tier: input.newTier,
    },
    proration_behavior: "create_prorations",
  })
}
