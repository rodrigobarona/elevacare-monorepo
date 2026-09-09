import { createHash, randomBytes } from "node:crypto"
import { eq, and, sql } from "drizzle-orm"
import type { Redis } from "@upstash/redis"
import { withAudit } from "@eleva/audit"
import { withOrgContext, type Tx } from "@eleva/db/context"
import { slotReservations, bookings, sessions } from "@eleva/db/schema"
import type { ReserveSlotInput, ReserveSlotResult } from "./types"

const DEFAULT_TTL_SECONDS = 300

function slotKey(expertProfileId: string, startsAtIso: string): string {
  return `slot:${expertProfileId}:${startsAtIso}`
}

async function compareAndDelete(
  redis: Redis,
  key: string,
  expectedValue: string
): Promise<void> {
  const script = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`
  try {
    await redis.eval(script, [key], [expectedValue])
  } catch {
    // best-effort cleanup
  }
}

/**
 * Atomic slot reservation. Uses Upstash Redis SET NX as a distributed
 * lock to prevent concurrent double-booking, then writes the
 * slot_reservations row inside an RLS-scoped DB transaction.
 *
 * Returns { success: true, reservationId, reservationToken } on success.
 * Returns { success: false, error } when the slot is already taken
 * or a conflict exists.
 */
export async function reserveSlot(
  redis: Redis,
  input: ReserveSlotInput
): Promise<ReserveSlotResult> {
  const {
    eventTypeId,
    expertProfileId,
    expertUserId,
    orgId,
    startsAt,
    endsAt,
    holdToken,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    userId,
    eventTypeModeId,
    price,
    afterInsert,
    audit,
  } = input
  const reservationToken = randomBytes(32).toString("base64url")
  const capabilityHash = createHash("sha256")
    .update(reservationToken)
    .digest("hex")

  const key = slotKey(expertProfileId, startsAt.toISOString())

  const acquired = await redis.set(key, holdToken, {
    nx: true,
    ex: ttlSeconds,
  })

  if (!acquired) {
    return { success: false, error: "slot_taken" }
  }

  try {
    const writeReservation = async (tx: Tx): Promise<string> => {
      await expireOverlappingHolds(tx, expertUserId, startsAt, endsAt)
      const conflict = await checkConflicts(
        tx,
        expertProfileId,
        startsAt,
        endsAt
      )
      if (conflict) {
        throw new ConflictError()
      }

      const [row] = await tx
        .insert(slotReservations)
        .values({
          orgId,
          eventTypeId,
          expertProfileId,
          expertUserId,
          capabilityHash,
          userId,
          eventTypeModeId,
          priceCents: price?.cents,
          currency: price?.currency,
          startsAt,
          endsAt,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
          holdToken,
          status: "active",
        })
        .returning({ id: slotReservations.id })

      const reservationId = row!.id
      if (afterInsert) {
        await afterInsert(tx, reservationId)
      }
      return reservationId
    }

    const reservationId = audit
      ? await withAudit(
          { orgId, actorUserId: audit.actorUserId ?? null },
          async (tx, ctx) => {
            const id = await writeReservation(tx)
            await ctx.emit({
              entity: "booking",
              action: "reserved",
              entityId: id,
              payload: {
                ...audit.payload,
                eventTypeId,
                eventTypeModeId,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
              },
            })
            return id
          }
        )
      : await withOrgContext(orgId, writeReservation)

    return { success: true, reservationId, reservationToken }
  } catch (err) {
    await compareAndDelete(redis, key, holdToken)

    if (err instanceof LinkClaimError) {
      return { success: false, error: "link_unusable" }
    }
    if (err instanceof ConflictError || isExclusionViolation(err)) {
      return { success: false, error: "conflict" }
    }
    return { success: false, error: "db_error" }
  }
}

/**
 * Release an expired or cancelled reservation. Called by the
 * slotReservationExpiry workflow.
 */
export async function releaseReservation(
  redis: Redis,
  orgId: string,
  reservationId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        expertProfileId: slotReservations.expertProfileId,
        startsAt: slotReservations.startsAt,
        status: slotReservations.status,
        holdToken: slotReservations.holdToken,
      })
      .from(slotReservations)
      .where(eq(slotReservations.id, reservationId))
      .limit(1)

    if (!row || row.status !== "active") return

    await tx
      .update(slotReservations)
      .set({ status: "released" })
      .where(eq(slotReservations.id, reservationId))

    const key = slotKey(row.expertProfileId, row.startsAt.toISOString())
    await compareAndDelete(redis, key, row.holdToken)
  })
}

/**
 * Convert a reservation to a booking after payment succeeds.
 */
export async function convertReservation(
  redis: Redis,
  orgId: string,
  reservationId: string,
  bookingId: string
): Promise<{ converted: boolean }> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const updated = await tx
      .update(slotReservations)
      .set({ status: "converted", bookingId })
      .where(
        and(
          eq(slotReservations.id, reservationId),
          eq(slotReservations.status, "active")
        )
      )
      .returning({
        expertProfileId: slotReservations.expertProfileId,
        startsAt: slotReservations.startsAt,
        holdToken: slotReservations.holdToken,
      })

    if (updated.length === 0) {
      return { converted: false }
    }

    const row = updated[0]!
    const key = slotKey(row.expertProfileId, row.startsAt.toISOString())
    await compareAndDelete(redis, key, row.holdToken)

    return { converted: true }
  })
}

/**
 * Exclusion cannot use `expires_at > now()` (index predicates must be
 * immutable). Move stale holds out of the constrained statuses in the
 * same transaction so a new insert is not blocked by 23P01.
 */
async function expireOverlappingHolds(
  tx: Tx,
  expertUserId: string,
  startsAt: Date,
  endsAt: Date
): Promise<void> {
  const now = new Date()
  await tx
    .update(slotReservations)
    .set({ status: "expired" })
    .where(
      and(
        eq(slotReservations.expertUserId, expertUserId),
        eq(slotReservations.status, "active"),
        sql`${slotReservations.expiresAt} <= ${now}`,
        sql`${slotReservations.startsAt} < ${endsAt}`,
        sql`${slotReservations.endsAt} > ${startsAt}`
      )
    )
}

async function checkConflicts(
  tx: Tx,
  expertProfileId: string,
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const now = new Date()
  const [activeReservation] = await tx
    .select({ id: slotReservations.id })
    .from(slotReservations)
    .where(
      and(
        eq(slotReservations.expertProfileId, expertProfileId),
        eq(slotReservations.status, "active"),
        sql`${slotReservations.expiresAt} > ${now}`,
        sql`${slotReservations.startsAt} < ${endsAt}`,
        sql`${slotReservations.endsAt} > ${startsAt}`
      )
    )
    .limit(1)

  if (activeReservation) return true

  const [existingBooking] = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.expertProfileId, expertProfileId),
        sql`${bookings.status} NOT IN ('cancelled', 'no_show')`,
        sql`${bookings.startsAt} < ${endsAt}`,
        sql`${bookings.endsAt} > ${startsAt}`
      )
    )
    .limit(1)

  if (existingBooking) return true

  const [existingSession] = await tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.expertProfileId, expertProfileId),
        sql`${sessions.status} NOT IN ('cancelled', 'no_show')`,
        sql`${sessions.startsAt} < ${endsAt}`,
        sql`${sessions.endsAt} > ${startsAt}`
      )
    )
    .limit(1)

  return !!existingSession
}

class ConflictError extends Error {
  constructor() {
    super("slot_conflict")
    this.name = "ConflictError"
  }
}

export class LinkClaimError extends Error {
  constructor() {
    super("link_unusable")
    this.name = "LinkClaimError"
  }
}

function isExclusionViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "23P01"
  )
}
