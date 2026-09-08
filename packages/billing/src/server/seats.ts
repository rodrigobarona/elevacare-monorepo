import { Redis } from "@upstash/redis"
import { eq, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { countBillableSeats, db, main, withOrgContext } from "@eleva/db"
import { organization } from "@eleva/db/schema/auth"
import { stripe } from "./client"

export interface SyncSeatQuantityResult {
  synced: boolean
  quantity?: number
}

export interface SyncSeatQuantityDeps {
  countSeats?: (orgId: string) => Promise<number>
  getOrgType?: (orgId: string) => Promise<string | undefined>
  getSeatItemId?: (orgId: string) => Promise<string | null | undefined>
  updateSeatItem?: (itemId: string, quantity: number) => Promise<void>
}

const inflight = new Map<string, Promise<SyncSeatQuantityResult>>()
const SEAT_LOCK_TTL_SECONDS = 30
const SEAT_LOCK_WAIT_MS = 50
const SEAT_LOCK_ATTEMPTS = 40

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

async function defaultSeatItemId(
  orgId: string
): Promise<string | null | undefined> {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({ seatItemId: main.billingSubscriptions.seatItemId })
      .from(main.billingSubscriptions)
      .where(eq(main.billingSubscriptions.orgId, orgId))
      .limit(1)
    return row?.seatItemId
  })
}

async function defaultUpdateSeatItem(
  itemId: string,
  quantity: number
): Promise<void> {
  await stripe().subscriptionItems.update(itemId, { quantity })
}

async function markSeatSyncPending(orgId: string): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(main.billingSubscriptions)
      .set({
        metadata: sql`coalesce(${main.billingSubscriptions.metadata}, '{}'::jsonb) || '{"seatSyncPending":true}'::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(main.billingSubscriptions.orgId, orgId))
  })
}

async function clearSeatSyncPending(orgId: string): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(main.billingSubscriptions)
      .set({
        metadata: sql`coalesce(${main.billingSubscriptions.metadata}, '{}'::jsonb) - 'seatSyncPending'`,
        updatedAt: new Date(),
      })
      .where(eq(main.billingSubscriptions.orgId, orgId))
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
        return await fn()
      } finally {
        const current = await redis.get<string>(key)
        if (current === token) await redis.del(key)
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
    return { synced: false }
  }

  const getSeatItemId = deps.getSeatItemId ?? defaultSeatItemId
  const seatItemId = await getSeatItemId(orgId)
  if (!seatItemId) {
    return { synced: false }
  }

  const countSeats = deps.countSeats ?? countBillableSeats
  const updateSeatItem = deps.updateSeatItem ?? defaultUpdateSeatItem
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const quantity = await countSeats(orgId)
      await updateSeatItem(seatItemId, quantity)
      return { synced: true, quantity }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error("seat sync failed")
}

/**
 * Team orgs with a billing subscription update the licensed seat item
 * to the number of members who have a published event type. No-op otherwise.
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

export async function syncSeatQuantityAudited(
  orgId: string,
  actorUserId?: string | null
): Promise<SyncSeatQuantityResult> {
  return withAudit({ orgId, actorUserId }, async (_tx, ctx) => {
    try {
      const result = await syncSeatQuantity(orgId)
      await ctx.emit({
        entity: "billing_subscription",
        action: "synced",
        entityId: orgId,
        payload: { synced: result.synced, quantity: result.quantity },
      })
      return result
    } catch (err) {
      await ctx.emit({
        entity: "billing_subscription",
        action: "failed",
        entityId: orgId,
        payload: {
          retry: "seat_sync",
          error: err instanceof Error ? err.message : String(err),
        },
      })
      throw err
    }
  })
}

/** Persist a seat-sync request, then process it. The pending flag survives a failed Stripe write. */
export async function enqueueSeatSync(
  orgId: string,
  actorUserId?: string | null
): Promise<SyncSeatQuantityResult> {
  await markSeatSyncPending(orgId)
  const result = await syncSeatQuantityAudited(orgId, actorUserId)
  await clearSeatSyncPending(orgId)
  return result
}
