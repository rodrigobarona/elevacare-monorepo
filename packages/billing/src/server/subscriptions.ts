import type Stripe from "stripe"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { eq } from "drizzle-orm"
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
    limit: 10,
  })

  const basePrice = prices.data.find(
    (p) => p.metadata.eleva_price_type === "base"
  )
  return basePrice?.id ?? prices.data[0]?.id ?? null
}

/**
 * Finds the per-seat price for a given product tier, if one exists.
 * Prefers the metered (`per_seat_metered`) price over the legacy
 * licensed (`per_seat`) price so clinics opt into WorkOS Seat Sync as
 * soon as `seed-products.ts --apply` creates the metered price.
 */
async function findSeatPriceWithType(
  tier: ProductTier
): Promise<{ priceId: string; metered: boolean } | null> {
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
    limit: 10,
  })

  // Prefer metered, fall back to legacy licensed.
  const meteredPrice = prices.data.find(
    (p) => p.metadata.eleva_price_type === "per_seat_metered"
  )
  if (meteredPrice) {
    return { priceId: meteredPrice.id, metered: true }
  }
  const licensedPrice = prices.data.find(
    (p) => p.metadata.eleva_price_type === "per_seat"
  )
  if (licensedPrice) {
    return { priceId: licensedPrice.id, metered: false }
  }
  return null
}

async function buildSubscriptionItems(input: {
  tier: ProductTier
  quantity?: number
}): Promise<{
  items: Array<{ price: string; quantity?: number }>
  priceId: string
} | null> {
  const priceId = await findTierPrice(input.tier)
  if (!priceId) return null

  const items: Array<{ price: string; quantity?: number }> = [
    { price: priceId, quantity: 1 },
  ]

  const seatPrice = await findSeatPriceWithType(input.tier)
  if (seatPrice) {
    if (seatPrice.metered) {
      items.push({ price: seatPrice.priceId })
    } else if (input.quantity && input.quantity > 0) {
      items.push({ price: seatPrice.priceId, quantity: input.quantity })
    }
  }

  return { items, priceId }
}

export async function getBillingCustomerForOrg(
  orgId: string
): Promise<{ stripeCustomerId: string; workosOrgId: string } | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        stripeCustomerId: main.billingCustomers.stripeCustomerId,
        workosOrgId: main.billingCustomers.workosOrgId,
      })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, orgId))
      .limit(1)
    return rows[0] ?? null
  })
}

/**
 * Creates a subscription for an org on the given tier.
 * Used during provisioning to give every org a subscription from day one.
 *
 * Base tier is always quantity=1. For clinic tiers a metered seat item
 * priced against the WorkOS-managed `workos_seat_count` Billing Meter
 * is attached automatically (per ADR-016 + W5). The application MUST
 * NOT pass `quantity` for metered seat items; WorkOS Seat Sync owns
 * member-count reporting.
 *
 * `eleva_org_id` and `eleva_tier` are stamped in subscription metadata
 * so the webhook can resolve the tenant from event metadata even
 * before the local mirror has caught up.
 */
export async function createOrgSubscription(input: {
  customerId: string
  tier: ProductTier
  orgId: string
  /** Legacy: only honored for non-metered seat prices. */
  quantity?: number
}): Promise<Stripe.Subscription | null> {
  const itemResult = await buildSubscriptionItems(input)
  if (!itemResult) return null

  return stripe().subscriptions.create({
    customer: input.customerId,
    items: itemResult.items,
    payment_behavior: "default_incomplete",
    metadata: {
      eleva_tier: input.tier,
      eleva_org_id: input.orgId,
    },
  })
}

export async function createSubscriptionCheckoutSession(input: {
  customerId: string
  tier: ProductTier
  orgId: string
  workosOrgId: string
  actorUserId: string
  returnUrl: string
  quantity?: number
}): Promise<{ id: string; clientSecret: string }> {
  const itemResult = await buildSubscriptionItems(input)
  if (!itemResult) {
    throw new Error(`Product for tier '${input.tier}' not found in Stripe.`)
  }

  const session = await stripe().checkout.sessions.create(
    {
      mode: "subscription",
      ui_mode: "embedded_page",
      customer: input.customerId,
      client_reference_id: `${input.orgId}:${input.actorUserId}`,
      line_items: itemResult.items,
      return_url: input.returnUrl,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      metadata: {
        eleva_org_id: input.orgId,
        workos_org_id: input.workosOrgId,
        eleva_tier: input.tier,
      },
      subscription_data: {
        metadata: {
          eleva_org_id: input.orgId,
          workos_org_id: input.workosOrgId,
          eleva_tier: input.tier,
        },
      },
    },
    {
      idempotencyKey: `checkout_${input.orgId}_${input.tier}_${input.actorUserId}`,
    }
  )

  if (!session.client_secret) {
    throw new Error("Stripe Checkout returned no client_secret")
  }

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "billing_checkout",
        action: "session_created",
        entityId: session.id,
        payload: {
          stripeCheckoutSessionId: session.id,
          stripeCustomerId: input.customerId,
          tier: input.tier,
          returnUrl: input.returnUrl,
        },
      })
    }
  )

  return { id: session.id, clientSecret: session.client_secret }
}

export async function createBillingPortalSession(input: {
  customerId: string
  orgId: string
  actorUserId: string
  returnUrl: string
  configurationId?: string
}): Promise<{ id: string; url: string }> {
  const session = await stripe().billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
    ...(input.configurationId && { configuration: input.configurationId }),
  })

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "billing_portal",
        action: "session_minted",
        entityId: session.id,
        payload: {
          stripeBillingPortalSessionId: session.id,
          stripeCustomerId: input.customerId,
          configurationId: input.configurationId ?? null,
          returnUrl: input.returnUrl,
        },
      })
    }
  )

  return { id: session.id, url: session.url }
}

/**
 * Swaps an existing subscription to a different tier.
 * Used for upgrades (Expert Community -> Top Expert) and clinic tier changes.
 */
export async function swapSubscriptionTier(input: {
  subscriptionId: string
  newTier: ProductTier
  orgId: string
  /** Legacy: only honored for non-metered seat prices. */
  quantity?: number
}): Promise<Stripe.Subscription | null> {
  const newPriceId = await findTierPrice(input.newTier)
  if (!newPriceId) return null

  const subscription = await stripe().subscriptions.retrieve(
    input.subscriptionId
  )

  const currentBaseItem = subscription.items.data.find(
    (item) =>
      item.price.metadata?.eleva_price_type !== "per_seat" &&
      item.price.metadata?.eleva_price_type !== "per_seat_metered"
  )
  const currentSeatItem = subscription.items.data.find(
    (item) =>
      item.price.metadata?.eleva_price_type === "per_seat" ||
      item.price.metadata?.eleva_price_type === "per_seat_metered"
  )

  const items: Stripe.SubscriptionUpdateParams.Item[] = []

  if (currentBaseItem) {
    items.push({ id: currentBaseItem.id, price: newPriceId, quantity: 1 })
  } else {
    items.push({ price: newPriceId, quantity: 1 })
  }

  const newSeatPrice = await findSeatPriceWithType(input.newTier)
  if (newSeatPrice) {
    const itemUpdate: Stripe.SubscriptionUpdateParams.Item = {
      price: newSeatPrice.priceId,
    }
    if (currentSeatItem) itemUpdate.id = currentSeatItem.id
    if (!newSeatPrice.metered && input.quantity && input.quantity > 0) {
      itemUpdate.quantity = input.quantity
    }
    items.push(itemUpdate)
  } else if (currentSeatItem) {
    items.push({ id: currentSeatItem.id, deleted: true })
  }

  return stripe().subscriptions.update(input.subscriptionId, {
    items,
    payment_behavior: "default_incomplete",
    metadata: {
      eleva_tier: input.newTier,
      eleva_org_id: input.orgId,
    },
    proration_behavior: "create_prorations",
  })
}
