import { and, eq, exists, inArray, lte, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"

export type ExpiredReservationCandidate = {
  id: string
  orgId: string
  stripePaymentIntentId: string | null
  hasIntentPendingPayment: boolean
}

export type FinalizeExpiredReservationResult = {
  expired: boolean
  bookingCancelled: boolean
  linkUseReleased: boolean
}

export async function listExpiredReservations(input: {
  now: Date
  limit: number
}): Promise<ExpiredReservationCandidate[]> {
  return withPlatformAdminContext(async (tx) =>
    tx
      .select({
        id: main.slotReservations.id,
        orgId: main.slotReservations.orgId,
        stripePaymentIntentId: main.slotReservations.stripePaymentIntentId,
        hasIntentPendingPayment: exists(
          tx
            .select({ id: main.bookingPayments.id })
            .from(main.bookingPayments)
            .innerJoin(
              main.bookings,
              eq(main.bookings.id, main.bookingPayments.bookingId)
            )
            .where(
              and(
                eq(main.bookings.reservationId, main.slotReservations.id),
                eq(main.bookingPayments.status, "intent_pending")
              )
            )
        ).mapWith(Boolean),
      })
      .from(main.slotReservations)
      .where(
        and(
          eq(main.slotReservations.status, "active"),
          lte(main.slotReservations.expiresAt, input.now)
        )
      )
      .orderBy(main.slotReservations.expiresAt, main.slotReservations.id)
      .limit(input.limit)
  )
}

/**
 * Expires one reservation after Stripe confirmed no payment can still land:
 * cancels its `pending_payment` booking, fails the unpaid payment row and
 * gives a claimed private-link use back. Re-checks `expires_at` under the
 * row lock because `payment_intent.processing` may have extended it.
 */
export async function finalizeExpiredReservation(input: {
  orgId: string
  reservationId: string
  cancelledIntentIds: string[]
  now: Date
}): Promise<FinalizeExpiredReservationResult> {
  return withAudit(
    { orgId: input.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [current] = await tx
        .select({ funnel: main.slotReservations.funnel })
        .from(main.slotReservations)
        .where(
          and(
            eq(main.slotReservations.id, input.reservationId),
            eq(main.slotReservations.status, "active"),
            lte(main.slotReservations.expiresAt, input.now)
          )
        )
        .limit(1)
        .for("update")

      const result: FinalizeExpiredReservationResult = {
        expired: false,
        bookingCancelled: false,
        linkUseReleased: false,
      }

      if (current) {
        await tx
          .update(main.slotReservations)
          .set({ status: "expired", funnel: sql`"funnel" - 'guest'` })
          .where(eq(main.slotReservations.id, input.reservationId))
        result.expired = true

        const bookingLinkId = current.funnel?.bookingLinkId ?? null
        if (bookingLinkId) {
          const released = await tx
            .update(main.bookingLinks)
            .set({
              useCount: sql`greatest(${main.bookingLinks.useCount} - 1, 0)`,
            })
            .where(eq(main.bookingLinks.id, bookingLinkId))
            .returning({ id: main.bookingLinks.id })
          result.linkUseReleased = released.length > 0
        }

        const cancelled = await tx
          .update(main.bookings)
          .set({
            status: "cancelled",
            cancellationReason: "reservation_expired",
            cancelledAt: input.now,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(main.bookings.reservationId, input.reservationId),
              eq(main.bookings.status, "pending_payment")
            )
          )
          .returning({ id: main.bookings.id })
        const bookingIds = cancelled.map((row) => row.id)
        if (bookingIds.length > 0) {
          result.bookingCancelled = true
          await tx
            .update(main.bookingPayments)
            .set({ status: "failed" })
            .where(
              and(
                inArray(main.bookingPayments.bookingId, bookingIds),
                inArray(main.bookingPayments.status, [
                  "intent_pending",
                  "requires_payment",
                ])
              )
            )
        }
      }

      await ctx.emit({
        entity: "slot_reservation",
        action: "expired",
        entityId: input.reservationId,
        payload: { ...result, cancelledIntentIds: input.cancelledIntentIds },
      })
      return result
    }
  )
}
