import { and, eq, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { getExpertBookingForApproval, main } from "@eleva/db"
import { emitBookingNotificationEvent } from "./emit-domain-event"

/** A session the expert can still cancel: confirmed, and not started. */
const EXPERT_CANCELLABLE_STATUSES = new Set(["confirmed", "rescheduled"])
const REASON_MAX_LENGTH = 180

export type ExpertCancelErrorCode = "not_found" | "INVALID_STATUS" | "TOO_LATE"

export class ExpertCancelError extends Error {
  readonly code: ExpertCancelErrorCode

  constructor(code: ExpertCancelErrorCode) {
    super(code)
    this.name = "ExpertCancelError"
    this.code = code
  }
}

/**
 * The expert cancels a confirmed session before it starts. The member is
 * always refunded everything they paid (terms: "if the expert cancels or
 * does not attend, you receive a full refund"), whatever the service's
 * cancellation policy says: that policy binds the member, not the expert.
 *
 * The refund itself is made by the refund sweep, which pays what
 * `refund_due_cents` asks for. The `booking.cancelled` event tells both
 * people, removes the calendar entry and closes the video room.
 */
export async function cancelBookingByExpert(input: {
  actorUserId: string
  orgId: string
  expertProfileId: string
  bookingId: string
  /** Kept on the booking record; not sent to the member. */
  reason?: string
  now?: Date
}): Promise<{ refundCents: number }> {
  const now = input.now ?? new Date()
  const row = await getExpertBookingForApproval({
    orgId: input.orgId,
    expertProfileId: input.expertProfileId,
    bookingId: input.bookingId,
  })
  if (!row) throw new ExpertCancelError("not_found")
  // Pressed twice, or two tabs: the second answer is the same, with
  // nothing more to refund.
  if (row.status === "cancelled") return { refundCents: 0 }
  if (!EXPERT_CANCELLABLE_STATUSES.has(row.status)) {
    throw new ExpertCancelError("INVALID_STATUS")
  }
  if (row.startsAt.getTime() <= now.getTime()) {
    throw new ExpertCancelError("TOO_LATE")
  }

  const refundCents =
    row.paymentStatus === "succeeded" && row.paymentAmountCents !== null
      ? row.paymentAmountCents - (row.paymentRefundedCents ?? 0)
      : 0

  await withAudit(
    { orgId: row.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [updated] = await tx
        .update(main.bookings)
        .set({
          status: "cancelled",
          cancellationReason: expertCancelReason(input.reason),
          cancelledAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(main.bookings.id, row.id),
            eq(main.bookings.status, row.status),
            eq(main.bookings.startsAt, row.startsAt)
          )
        )
        .returning({ id: main.bookings.id })
      // Moved or cancelled by the member in the meantime.
      if (!updated) throw new ExpertCancelError("INVALID_STATUS")

      if (row.paymentId && refundCents > 0) {
        const [payment] = await tx
          .update(main.bookingPayments)
          .set({
            refundDueCents: (row.paymentRefundedCents ?? 0) + refundCents,
            status: "refund_pending",
          })
          .where(
            and(
              eq(main.bookingPayments.id, row.paymentId),
              eq(main.bookingPayments.status, "succeeded"),
              eq(
                main.bookingPayments.refundedCents,
                row.paymentRefundedCents ?? 0
              )
            )
          )
          .returning({ id: main.bookingPayments.id })
        if (!payment) throw new ExpertCancelError("INVALID_STATUS")
      }

      if (row.reservationId) {
        // A paid booking's reservation is `converted`, which still blocks
        // the time: release it so the slot can be booked again.
        await tx
          .update(main.slotReservations)
          .set({ status: "released" })
          .where(
            and(
              eq(main.slotReservations.id, row.reservationId),
              inArray(main.slotReservations.status, ["active", "converted"])
            )
          )
      }

      await emitBookingNotificationEvent(tx, {
        orgId: row.orgId,
        type: "booking.cancelled",
        bookingId: row.id,
        startsAt: row.startsAt,
        occurredAt: now,
        cancelledBy: "expert",
        ...(refundCents > 0 ? { refundCents } : {}),
      })
      await ctx.emit({
        entity: "booking",
        action: "canceled",
        entityId: row.id,
        payload: {
          reason: "expert_cancel",
          refundPercent: 100,
          refundCents,
        },
      })
    }
  )

  return { refundCents }
}

/** `expert_cancel`, with the expert's own words after it when given. */
export function expertCancelReason(reason?: string): string {
  const trimmed = reason?.trim()
  if (!trimmed) return "expert_cancel"
  return `expert_cancel: ${trimmed.slice(0, REASON_MAX_LENGTH)}`
}
