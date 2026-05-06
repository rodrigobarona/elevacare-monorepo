import { and, eq, lte, sql } from "drizzle-orm"
import { db, main } from "@eleva/db"
import { captureException, heartbeat } from "@eleva/observability"

/**
 * Expire active slot reservations whose TTL has passed. Runs on a
 * periodic schedule (e.g., every 30 seconds via cron or Vercel Workflow).
 *
 * Flow: find active reservations where expires_at < now → mark as
 * 'expired'. The Redis key has its own TTL and self-evicts, so this
 * workflow only needs to clean up the DB rows for accurate conflict
 * checks.
 */

export interface SlotExpiryResult {
  expired: number
  errors: number
}

export async function expireStaleReservations(): Promise<SlotExpiryResult> {
  const mainDb = db()
  const result: SlotExpiryResult = { expired: 0, errors: 0 }

  try {
    const updated = await mainDb
      .update(main.slotReservations)
      .set({ status: "expired" })
      .where(
        and(
          eq(main.slotReservations.status, "active"),
          lte(main.slotReservations.expiresAt, new Date())
        )
      )
      .returning({ id: main.slotReservations.id })

    result.expired = updated.length
  } catch (err) {
    result.errors += 1
    await captureException(err, { workflow: "slotReservationExpiry" })
  }

  void sql
  await heartbeat("slot-reservation-expiry")
  return result
}
