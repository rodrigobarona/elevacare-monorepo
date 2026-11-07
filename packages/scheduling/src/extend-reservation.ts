import { timingSafeEqual } from "node:crypto"
import { and, eq, gt } from "drizzle-orm"
import type { Redis } from "@upstash/redis"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { hashReservationToken } from "./reservation-token"

/** Each extension keeps the time for this much longer. */
export const HOLD_EXTENSION_MS = 5 * 60 * 1000

/**
 * A hold never runs past this long after it was created. 60 minutes
 * allows more than ten 5-minute extensions (WCAG 2.2.1 "extend at least
 * ten times") while still freeing the slot for other members.
 */
export const MAX_HOLD_MS = 60 * 60 * 1000

export type ExtendReservationHoldResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; error: "not_found" | "expired" | "limit_reached" }

class HoldNoLongerActive extends Error {}

function tokensMatch(storedHash: string, token: string): boolean {
  const computed = Buffer.from(hashReservationToken(token))
  const stored = Buffer.from(storedHash)
  return computed.length === stored.length && timingSafeEqual(computed, stored)
}

/** Next expiry: +5 minutes from now, never past the 60-minute cap. */
export function nextHoldExpiry(createdAt: Date, now: Date): Date | null {
  const cap = createdAt.getTime() + MAX_HOLD_MS
  const next = Math.min(now.getTime() + HOLD_EXTENSION_MS, cap)
  return next <= now.getTime() ? null : new Date(next)
}

/**
 * Give the member more time to finish booking before an active hold
 * expires. Only the holder of the one-time reservation token (and, for a
 * signed-in hold, the same user) can extend it.
 */
export async function extendReservationHold(
  redis: Redis | null,
  input: {
    reservationId: string
    reservationToken: string
    sessionUserId?: string
    now?: Date
  }
): Promise<ExtendReservationHoldResult> {
  const now = input.now ?? new Date()
  const [row] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        orgId: main.slotReservations.orgId,
        userId: main.slotReservations.userId,
        status: main.slotReservations.status,
        expiresAt: main.slotReservations.expiresAt,
        createdAt: main.slotReservations.createdAt,
        capabilityHash: main.slotReservations.capabilityHash,
        holdToken: main.slotReservations.holdToken,
        expertProfileId: main.slotReservations.expertProfileId,
        startsAt: main.slotReservations.startsAt,
      })
      .from(main.slotReservations)
      .where(eq(main.slotReservations.id, input.reservationId))
      .limit(1)
  )
  if (!row || !tokensMatch(row.capabilityHash, input.reservationToken)) {
    return { ok: false, error: "not_found" }
  }
  if (row.userId && row.userId !== input.sessionUserId) {
    return { ok: false, error: "not_found" }
  }
  if (row.status !== "active" || row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: "expired" }
  }
  const expiresAt = nextHoldExpiry(row.createdAt, now)
  if (!expiresAt || expiresAt.getTime() <= row.expiresAt.getTime()) {
    return { ok: false, error: "limit_reached" }
  }

  try {
    await withAudit(
      { orgId: row.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        const rows = await tx
          .update(main.slotReservations)
          .set({ expiresAt })
          .where(
            and(
              eq(main.slotReservations.id, input.reservationId),
              eq(main.slotReservations.status, "active"),
              gt(main.slotReservations.expiresAt, now)
            )
          )
          .returning({ id: main.slotReservations.id })
        // Lost the race with expiry or payment: roll back, emit nothing.
        if (rows.length === 0) throw new HoldNoLongerActive()
        await ctx.emit({
          entity: "slot_reservation",
          action: "extended",
          entityId: input.reservationId,
          payload: { expiresAt: expiresAt.toISOString() },
        })
      }
    )
  } catch (err) {
    if (err instanceof HoldNoLongerActive)
      return { ok: false, error: "expired" }
    throw err
  }

  // Keep the Redis slot lock alive while we still own it. The DB row and
  // its exclusion constraint stay the source of truth if Redis is gone.
  if (redis) {
    const key = `slot:${row.expertProfileId}:${row.startsAt.toISOString()}`
    const ttlMs = Math.max(1, expiresAt.getTime() - now.getTime())
    try {
      await redis.eval(
        `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) else return 0 end`,
        [key],
        [row.holdToken, String(ttlMs)]
      )
    } catch {
      // best effort, see above
    }
  }
  return { ok: true, expiresAt }
}
