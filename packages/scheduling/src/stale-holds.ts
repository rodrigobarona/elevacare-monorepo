import { and, eq, sql, type SQL } from "drizzle-orm"
import type { Tx } from "@eleva/db/context"
import { slotReservations } from "@eleva/db/schema"

/**
 * Exclusion cannot use `expires_at > now()` (index predicates must be
 * immutable). Move stale holds out of the constrained statuses in the
 * same transaction so a write into the range is not blocked by 23P01.
 */
export async function expireOverlappingHolds(
  tx: Tx,
  expertUserId: string | SQL,
  startsAt: Date,
  endsAt: Date,
  now: Date = new Date()
): Promise<void> {
  await tx
    .update(slotReservations)
    .set({ status: "expired", funnel: sql`"funnel" - 'guest'` })
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
