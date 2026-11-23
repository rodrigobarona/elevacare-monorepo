import { createHash } from "node:crypto"
import type Stripe from "stripe"
import { withAudit } from "@eleva/audit"
import { countBillableSeats, main, withPlatformAdminContext } from "@eleva/db"
import { eq } from "drizzle-orm"
import { stripe } from "./client"
import { SEAT_PRICE_TYPE } from "./seat-cap"

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
 */
export async function createOrgCustomer(input: {
  orgName: string
  orgId: string
  email?: string
}): Promise<Stripe.Customer> {
  return stripe().customers.create({
    name: input.orgName,
    email: input.email,
    metadata: {
      eleva_org_id: input.orgId,
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
 * Finds the per-seat price for a given product tier, if one exists: a
 * licensed price whose quantity Eleva sets (`syncSeatQuantity`).
 */
async function findSeatPrice(tier: ProductTier): Promise<string | null> {
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
  return (
    prices.data.find((p) => p.metadata.eleva_price_type === SEAT_PRICE_TYPE)
      ?.id ?? null
  )
}

/**
 * The items of a subscription on `tier`: the plan, and for a clinic plan
 * the seat item, at the number of seats Eleva counts for this clinic. The
 * buyer never chooses that number.
 *
 * `allowZeroSeats`: a subscription accepts a seat item at quantity 0, so a
 * new clinic gets its seat item from the start. Checkout refuses a line at
 * 0 ("must be greater than or equal to 1", Stripe test mode 2026-11-22):
 * there the line is left out at 0 and the seat sync adds the item once the
 * subscription is active.
 */
async function buildSubscriptionItems(input: {
  tier: ProductTier
  orgId: string
  allowZeroSeats: boolean
}): Promise<{
  items: Array<{ price: string; quantity: number }>
  priceId: string
} | null> {
  const priceId = await findTierPrice(input.tier)
  if (!priceId) return null

  const items = [{ price: priceId, quantity: 1 }]

  const seatPriceId = await findSeatPrice(input.tier)
  if (seatPriceId) {
    const seats = await countBillableSeats(input.orgId)
    if (seats > 0 || input.allowZeroSeats) {
      items.push({ price: seatPriceId, quantity: seats })
    }
  }

  return { items, priceId }
}

export async function getBillingCustomerForOrg(
  orgId: string
): Promise<{ stripeCustomerId: string } | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        stripeCustomerId: main.billingCustomers.stripeCustomerId,
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
 * Base tier is always quantity=1. A clinic tier always gets its seat item
 * too (per ADR-016), at the number of seats the clinic has now, zero
 * included. From then on the quantity is owned by `syncSeatQuantity`.
 *
 * `eleva_org_id` and `eleva_tier` are stamped in subscription metadata
 * so the webhook can resolve the tenant from event metadata even
 * before the local mirror has caught up.
 */
export async function createOrgSubscription(input: {
  customerId: string
  tier: ProductTier
  orgId: string
}): Promise<Stripe.Subscription | null> {
  const itemResult = await buildSubscriptionItems({
    tier: input.tier,
    orgId: input.orgId,
    allowZeroSeats: true,
  })
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

/**
 * A Checkout Session is the same request only when it asks for the same
 * things. A key fixed per person and plan errors as soon as the seat count
 * or the return address differs. An identical request inside Stripe's
 * key lifetime still gets the same session back, finished or not: telling
 * a clinic that already pays from one that does not is 11.8's.
 */
function checkoutIdempotencyKey(input: {
  orgId: string
  tier: ProductTier
  actorUserId: string
  returnUrl: string
  items: Array<{ price: string; quantity: number }>
}): string {
  const request = createHash("sha256")
    .update(JSON.stringify([input.returnUrl, input.items]))
    .digest("hex")
    .slice(0, 16)
  return `checkout_${input.orgId}_${input.tier}_${input.actorUserId}_${request}`
}

export async function createSubscriptionCheckoutSession(input: {
  customerId: string
  tier: ProductTier
  orgId: string
  actorUserId: string
  returnUrl: string
}): Promise<{ id: string; clientSecret: string }> {
  const itemResult = await buildSubscriptionItems({
    tier: input.tier,
    orgId: input.orgId,
    allowZeroSeats: false,
  })
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
      // The customer exists already (provisioning made it, without an
      // address). Without this, what the buyer types in Checkout (the
      // company name, the address, and with them the VAT number) is not
      // saved on that customer.
      customer_update: { name: "auto", address: "auto" },
      metadata: {
        eleva_org_id: input.orgId,
        eleva_tier: input.tier,
      },
      subscription_data: {
        metadata: {
          eleva_org_id: input.orgId,
          eleva_tier: input.tier,
        },
      },
    },
    {
      idempotencyKey: checkoutIdempotencyKey({
        ...input,
        items: itemResult.items,
      }),
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
 *
 * The seat item moves to the new plan's seat price with its quantity given
 * outright: Stripe resets an item to 1 when its price changes and no
 * quantity is sent, which would bill one seat whatever the clinic has.
 */
export async function swapSubscriptionTier(input: {
  subscriptionId: string
  newTier: ProductTier
  orgId: string
}): Promise<Stripe.Subscription | null> {
  const newPriceId = await findTierPrice(input.newTier)
  if (!newPriceId) return null

  const subscription = await stripe().subscriptions.retrieve(
    input.subscriptionId
  )

  const isSeatItem = (item: Stripe.SubscriptionItem) =>
    item.price.metadata?.eleva_price_type === SEAT_PRICE_TYPE
  const currentBaseItem = subscription.items.data.find(
    (item) => !isSeatItem(item)
  )
  const currentSeatItem = subscription.items.data.find(isSeatItem)

  const items: Stripe.SubscriptionUpdateParams.Item[] = []

  if (currentBaseItem) {
    items.push({ id: currentBaseItem.id, price: newPriceId, quantity: 1 })
  } else {
    items.push({ price: newPriceId, quantity: 1 })
  }

  const newSeatPriceId = await findSeatPrice(input.newTier)
  if (newSeatPriceId) {
    const seats = await countBillableSeats(input.orgId)
    items.push({
      ...(currentSeatItem ? { id: currentSeatItem.id } : {}),
      price: newSeatPriceId,
      quantity: seats,
    })
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
