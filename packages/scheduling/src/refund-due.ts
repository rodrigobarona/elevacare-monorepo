import { and, eq, inArray } from "drizzle-orm"
import { main, type Tx } from "@eleva/db"

/**
 * The two writes every cancellation shares, whoever cancels: the member,
 * the expert declining a request, or the expert cancelling a session.
 * One place, so a guard is fixed once and not three times.
 */

/**
 * Says how much of a payment must be given back. The refund itself is made
 * later by the refund sweep, which pays what `refund_due_cents` asks for.
 *
 * `refund_due_cents` is the total refunded the payment must reach, so it
 * adds to what was refunded before. With nothing to refund the payment
 * stays `succeeded` and the expert is paid.
 *
 * The write only lands on the payment as it was read (still `succeeded`,
 * same amount refunded so far). It answers `false` when the payment has
 * changed in the meantime, for example a refund already in progress: the
 * caller must then stop and let its transaction roll back.
 */
export async function markRefundDue(
  tx: Tx,
  input: {
    paymentId: string
    /** Refunded before this cancellation, as read with the booking. */
    refundedCents: number
    /** What this cancellation gives back. */
    refundCents: number
  }
): Promise<boolean> {
  const [payment] = await tx
    .update(main.bookingPayments)
    .set({
      refundDueCents: input.refundedCents + input.refundCents,
      ...(input.refundCents > 0 ? { status: "refund_pending" as const } : {}),
    })
    .where(
      and(
        eq(main.bookingPayments.id, input.paymentId),
        eq(main.bookingPayments.status, "succeeded"),
        eq(main.bookingPayments.refundedCents, input.refundedCents)
      )
    )
    .returning({ id: main.bookingPayments.id })
  return Boolean(payment)
}

/**
 * Frees the time of a cancelled booking. A paid booking's reservation is
 * `converted`, which the overlap exclusion still enforces: releasing it
 * makes the slot bookable again.
 */
export async function releaseReservation(
  tx: Tx,
  reservationId: string
): Promise<void> {
  await tx
    .update(main.slotReservations)
    .set({ status: "released" })
    .where(
      and(
        eq(main.slotReservations.id, reservationId),
        inArray(main.slotReservations.status, ["active", "converted"])
      )
    )
}
