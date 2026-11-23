import { Redis } from "@upstash/redis"
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  countBillableSeats,
  db,
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { organization } from "@eleva/db/schema/auth"
import { stripe } from "./client"
import {
  CLINIC_PLAN_TIERS,
  CURRENT_SUBSCRIPTION_STATUSES,
  isCurrentSubscriptionStatus,
  SEAT_PRICE_TYPE,
} from "./seat-cap"

/** Why a sync sent nothing: all of them final, none an error to retry. */
export type SeatSyncSkipReason =
  | "not_a_clinic"
  | "no_current_subscription"
  /** Stripe says ended, unpaid or never paid, or the plan bills no seats. */
  | "nothing_to_bill_in_stripe"
  /** Stripe no longer has the subscription. */
  | "gone_in_stripe"

export interface SyncSeatQuantityResult {
  synced: boolean
  quantity?: number
  /** Set when `synced` is false. */
  reason?: SeatSyncSkipReason
  /**
   * Set when the sync found or created the seat item in Stripe and the
   * mirror did not know it yet: the caller stores it.
   */
  seatItem?: { stripeSubscriptionId: string; itemId: string; created: boolean }
}

/** The clinic's current subscription, as the mirror has it. */
export interface CurrentClinicSubscription {
  stripeSubscriptionId: string
  seatItemId: string | null
}

/** What the seat sync asks of Stripe. */
export interface SeatGateway {
  setQuantity: (itemId: string, quantity: number) => Promise<void>
  /**
   * The subscription's seat item: the one Stripe already has, or a new one
   * at `quantity`. Null when Stripe says the subscription is not current
   * (ended, unpaid, never paid) or its plan has no seat price.
   */
  ensureSeatItem: (
    stripeSubscriptionId: string,
    quantity: number
  ) => Promise<{ itemId: string; created: boolean } | null>
}

export interface SyncSeatQuantityDeps {
  countSeats?: (orgId: string) => Promise<number>
  getOrgType?: (orgId: string) => Promise<string | undefined>
  getCurrentSubscription?: (
    orgId: string
  ) => Promise<CurrentClinicSubscription | null>
  gateway?: SeatGateway
}

/**
 * How Stripe charges a seat change inside a billing period. It is Stripe's
 * default, written down so the accountant's answer (A-03) is a one-line
 * change for both the quantity update and a new seat item.
 */
const SEAT_PRORATION_BEHAVIOR = "create_prorations" as const

const inflight = new Map<string, Promise<SyncSeatQuantityResult>>()
const SEAT_LOCK_TTL_SECONDS = 180
const SEAT_LOCK_WAIT_MS = 50
const SEAT_LOCK_ATTEMPTS = 40
const RELEASE_LOCK_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

function redisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

async function defaultOrgType(orgId: string): Promise<string | undefined> {
  const [row] = await db()
    .select({ type: organization.type })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  return row?.type
}

/**
 * The subscription seats are billed on: a clinic plan in a current state.
 * A clinic often has an older row beside it (the unpaid one from
 * provisioning, a canceled one), which must never be picked. If two rows
 * qualify for a moment, the newest wins.
 */
async function defaultCurrentSubscription(
  orgId: string
): Promise<CurrentClinicSubscription | null> {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({
        stripeSubscriptionId: main.billingSubscriptions.stripeSubscriptionId,
        seatItemId: main.billingSubscriptions.seatItemId,
      })
      .from(main.billingSubscriptions)
      .where(
        and(
          eq(main.billingSubscriptions.orgId, orgId),
          inArray(main.billingSubscriptions.status, [
            ...CURRENT_SUBSCRIPTION_STATUSES,
          ]),
          inArray(main.billingSubscriptions.tier, CLINIC_PLAN_TIERS)
        )
      )
      .orderBy(desc(main.billingSubscriptions.createdAt))
      .limit(1)
    return row ?? null
  })
}

const stripeSeatGateway: SeatGateway = {
  async setQuantity(itemId, quantity) {
    await stripe().subscriptionItems.update(itemId, {
      quantity,
      proration_behavior: SEAT_PRORATION_BEHAVIOR,
    })
  },
  async ensureSeatItem(stripeSubscriptionId, quantity) {
    // Stripe is asked first: the mirror can be behind the webhook, and must
    // not be what decides to create an item.
    const subscription =
      await stripe().subscriptions.retrieve(stripeSubscriptionId)
    if (!isCurrentSubscriptionStatus(subscription.status)) return null
    const items = subscription.items.data
    const existing = items.find(
      (item) => item.price.metadata?.eleva_price_type === SEAT_PRICE_TYPE
    )
    if (existing) return { itemId: existing.id, created: false }

    // The seat price of this subscription's own plan, so another plan's
    // seat price can never be attached.
    const planItem =
      items.find((item) => item.price.metadata?.eleva_price_type === "base") ??
      items[0]
    if (!planItem) return null
    const product =
      typeof planItem.price.product === "string"
        ? planItem.price.product
        : planItem.price.product.id
    const prices = await stripe().prices.list({
      product,
      active: true,
      type: "recurring",
      limit: 10,
    })
    const seatPrice = prices.data.find(
      (price) => price.metadata.eleva_price_type === SEAT_PRICE_TYPE
    )
    if (!seatPrice) return null

    const item = await stripe().subscriptionItems.create(
      {
        subscription: stripeSubscriptionId,
        price: seatPrice.id,
        quantity,
        proration_behavior: SEAT_PRORATION_BEHAVIOR,
      },
      // A repeat of this very request gets the first answer. Stripe also
      // refuses a second item with a price the subscription already has.
      {
        idempotencyKey: `seat_item_${stripeSubscriptionId}_${seatPrice.id}_${quantity}`,
      }
    )
    return { itemId: item.id, created: true }
  },
}

/** Stripe's answer when the item or the subscription no longer exists. */
function isGoneInStripe(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "resource_missing"
  )
}

export async function markSeatSyncPending(
  orgId: string,
  tx?: Tx,
  generation: number = Date.now()
): Promise<number> {
  const write = async (dbTx: Tx) => {
    await dbTx
      .update(main.billingSubscriptions)
      .set({
        metadata: sql`jsonb_set(
          jsonb_set(
            coalesce(${main.billingSubscriptions.metadata}, '{}'::jsonb),
            '{seatSyncPending}',
            'true'::jsonb
          ),
          '{seatSyncGeneration}',
          to_jsonb(${generation}::bigint)
        )`,
        updatedAt: new Date(),
      })
      .where(eq(main.billingSubscriptions.orgId, orgId))
  }
  if (tx) {
    await write(tx)
    return generation
  }
  await withOrgContext(orgId, write)
  return generation
}

async function clearSeatSyncPending(
  orgId: string,
  generation: number
): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(main.billingSubscriptions)
      .set({
        metadata: sql`coalesce(${main.billingSubscriptions.metadata}, '{}'::jsonb)
          - 'seatSyncPending'
          - 'seatSyncGeneration'`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(main.billingSubscriptions.orgId, orgId),
          sql`(${main.billingSubscriptions.metadata}->>'seatSyncGeneration')::bigint = ${generation}`
        )
      )
  })
}

async function withSharedSeatLock<T>(
  orgId: string,
  fn: () => Promise<T>
): Promise<T> {
  const redis = redisClient()
  if (!redis) return fn()

  const key = `seat-sync-lock:${orgId}`
  const token = crypto.randomUUID()
  for (let attempt = 0; attempt < SEAT_LOCK_ATTEMPTS; attempt++) {
    const acquired = await redis.set(key, token, {
      nx: true,
      ex: SEAT_LOCK_TTL_SECONDS,
    })
    if (acquired) {
      try {
        await redis.expire(key, SEAT_LOCK_TTL_SECONDS)
        return await fn()
      } finally {
        await redis.eval(RELEASE_LOCK_LUA, [key], [token])
      }
    }
    await new Promise((resolve) => setTimeout(resolve, SEAT_LOCK_WAIT_MS))
  }
  throw new Error("seat sync lock timeout")
}

async function syncSeatQuantityOnce(
  orgId: string,
  deps: SyncSeatQuantityDeps
): Promise<SyncSeatQuantityResult> {
  const getOrgType = deps.getOrgType ?? defaultOrgType
  const orgType = await getOrgType(orgId)
  if (orgType !== "team") {
    return { synced: false, reason: "not_a_clinic" }
  }

  const getCurrentSubscription =
    deps.getCurrentSubscription ?? defaultCurrentSubscription
  const subscription = await getCurrentSubscription(orgId)
  // No current clinic subscription (none, unpaid, ended): nothing to bill
  // seats on. Not an error, and nothing to try again.
  if (!subscription) {
    return { synced: false, reason: "no_current_subscription" }
  }

  const countSeats = deps.countSeats ?? countBillableSeats
  const gateway = deps.gateway ?? stripeSeatGateway
  const { stripeSubscriptionId } = subscription

  /** Find the seat item in Stripe, or create it, at this count. */
  const viaStripe = async (
    quantity: number
  ): Promise<SyncSeatQuantityResult> => {
    const ensured = await gateway.ensureSeatItem(stripeSubscriptionId, quantity)
    if (!ensured) return { synced: false, reason: "nothing_to_bill_in_stripe" }
    // An item that was already there keeps whatever quantity it had.
    if (!ensured.created) await gateway.setQuantity(ensured.itemId, quantity)
    return {
      synced: true,
      quantity,
      seatItem: { stripeSubscriptionId, ...ensured },
    }
  }

  /** Set the item the mirror knows. False when Stripe no longer has it. */
  const setKnownItem = async (itemId: string, quantity: number) => {
    try {
      await gateway.setQuantity(itemId, quantity)
      return true
    } catch (error) {
      if (isGoneInStripe(error)) return false
      throw error
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Counted again on every attempt, and sent as the whole number (never
      // "one more"), so a repeat is harmless.
      const quantity = await countSeats(orgId)
      if (
        subscription.seatItemId &&
        (await setKnownItem(subscription.seatItemId, quantity))
      ) {
        return { synced: true, quantity }
      }
      // No item in the mirror, or the one it knew is gone: ask Stripe.
      return await viaStripe(quantity)
    } catch (error) {
      // The subscription itself is gone: the same answer next time, so it
      // ends here instead of failing every time it is tried.
      if (isGoneInStripe(error)) {
        return { synced: false, reason: "gone_in_stripe" }
      }
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("seat sync failed")
}

/**
 * A clinic's current subscription carries one seat item whose quantity is
 * the number of members with a published service. This sets that number,
 * and creates the item when Stripe has none (a clinic that subscribed with
 * no seats, or before seat items were attached). No-op for anything but a
 * clinic with a current subscription.
 * Concurrent calls for the same org are serialized and recount immediately
 * before the Stripe write so a stale in-flight update cannot win.
 */
export async function syncSeatQuantity(
  orgId: string,
  deps: SyncSeatQuantityDeps = {}
): Promise<SyncSeatQuantityResult> {
  return withSharedSeatLock(orgId, async () => {
    const prior = inflight.get(orgId) ?? Promise.resolve({ synced: false })
    const run = prior.then(
      () => syncSeatQuantityOnce(orgId, deps),
      () => syncSeatQuantityOnce(orgId, deps)
    )
    inflight.set(orgId, run)
    try {
      return await run
    } finally {
      if (inflight.get(orgId) === run) inflight.delete(orgId)
    }
  })
}

/**
 * The sync, then its record. Stripe is called first and the transaction
 * opens only afterwards: no vendor call runs inside a database transaction.
 */
export async function syncSeatQuantityAudited(
  orgId: string,
  actorUserId?: string | null,
  deps: SyncSeatQuantityDeps = {}
): Promise<SyncSeatQuantityResult> {
  let result: SyncSeatQuantityResult
  try {
    result = await syncSeatQuantity(orgId, deps)
  } catch (err) {
    await withAudit({ orgId, actorUserId }, async (_tx, ctx) => {
      await ctx.emit({
        entity: "billing_subscription",
        action: "failed",
        entityId: orgId,
        payload: {
          retry: "seat_sync",
          error: err instanceof Error ? err.message : String(err),
        },
      })
    })
    throw err
  }
  const { seatItem } = result
  await withAudit({ orgId, actorUserId }, async (tx, ctx) => {
    if (seatItem) {
      // The webhook writes the same value when it mirrors the subscription.
      await tx
        .update(main.billingSubscriptions)
        .set({ seatItemId: seatItem.itemId, updatedAt: new Date() })
        .where(
          and(
            eq(main.billingSubscriptions.orgId, orgId),
            eq(
              main.billingSubscriptions.stripeSubscriptionId,
              seatItem.stripeSubscriptionId
            )
          )
        )
    }
    await ctx.emit({
      entity: "billing_subscription",
      action: "synced",
      entityId: orgId,
      payload: {
        synced: result.synced,
        quantity: result.quantity,
        ...(result.reason ? { reason: result.reason } : {}),
        ...(seatItem
          ? { seatItemId: seatItem.itemId, seatItemCreated: seatItem.created }
          : {}),
      },
    })
  })
  return result
}

/** Persist a seat-sync request, then process it. The pending flag survives a failed Stripe write. */
export async function enqueueSeatSync(
  orgId: string,
  actorUserId?: string | null
): Promise<SyncSeatQuantityResult> {
  const generation = Date.now()
  await withAudit({ orgId, actorUserId }, async (tx, ctx) => {
    await markSeatSyncPending(orgId, tx, generation)
    await ctx.emit({
      entity: "billing_subscription",
      action: "updated",
      entityId: orgId,
      payload: { seatSyncPending: true, generation },
    })
  })
  const result = await syncSeatQuantityAudited(orgId, actorUserId)
  await clearSeatSyncPending(orgId, generation)
  return result
}

export interface SeatSyncSweepResult {
  /** Clinics whose seat count was waiting for Stripe. */
  pending: number
  synced: number
  failed: number
}

/** A sync still marked pending after this long was not finished. */
const SEAT_SYNC_STALE_MS = 2 * 60 * 1000

/**
 * Finishes seat syncs that were marked but never reached Stripe (the API
 * answered before Stripe did, or Stripe was unreachable; or the webhook
 * marked a clinic plan that became current). Runs every ten
 * minutes; each clinic is recounted and synced like a fresh request, so a
 * failure simply waits for the next run. Only marked rows are swept: a
 * clinic the sync has nothing to send for is not looked at again until
 * something marks it.
 */
export async function sweepPendingSeatSyncs(
  options: { limit?: number; now?: Date } = {}
): Promise<SeatSyncSweepResult> {
  const staleBefore = new Date(
    (options.now ?? new Date()).getTime() - SEAT_SYNC_STALE_MS
  )
  const rows = await withPlatformAdminContext((tx) =>
    tx
      .selectDistinct({ orgId: main.billingSubscriptions.orgId })
      .from(main.billingSubscriptions)
      .where(
        and(
          sql`${main.billingSubscriptions.metadata}->>'seatSyncPending' = 'true'`,
          lt(main.billingSubscriptions.updatedAt, staleBefore)
        )
      )
      .limit(options.limit ?? 50)
  )
  let synced = 0
  let failed = 0
  for (const { orgId } of rows) {
    try {
      await enqueueSeatSync(orgId, null)
      synced += 1
    } catch {
      // Audited as billing_subscription.failed; the mark stays for next run.
      failed += 1
    }
  }
  return { pending: rows.length, synced, failed }
}
