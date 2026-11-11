import { and, eq, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  getExpertBookingForApproval,
  main,
  type ExpertBookingApprovalRow,
} from "@eleva/db"
import { emitBookingNotificationEvent } from "./emit-domain-event"

/** A session the expert can still cancel: confirmed, and not started. */
const EXPERT_CANCELLABLE_STATUSES = new Set(["confirmed", "rescheduled"])
const REASON_MAX_LENGTH = 180

export type ExpertCancelErrorCode =
  | "not_found"
  | "INVALID_STATUS"
  | "TOO_LATE"
  /** The session is no longer at the time the expert was looking at. */
  | "SESSION_CHANGED"

export class ExpertCancelError extends Error {
  readonly code: ExpertCancelErrorCode

  constructor(code: ExpertCancelErrorCode) {
    super(code)
    this.name = "ExpertCancelError"
    this.code = code
  }
}

export type ExpertCancelResult = {
  /** What the member is refunded by this call. */
  refundCents: number
  /** It was cancelled before this call (a second press, or the member did). */
  alreadyCancelled: boolean
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
  /**
   * The start the expert saw when they chose to cancel. A calendar left
   * open can be stale: if the member has moved the session since, it is
   * not cancelled at its new time behind the expert's back.
   */
  expectedStartsAt?: Date
  now?: Date
}): Promise<ExpertCancelResult> {
  const now = input.now ?? new Date()
  const load = () =>
    getExpertBookingForApproval({
      orgId: input.orgId,
      expertProfileId: input.expertProfileId,
      bookingId: input.bookingId,
    })
  const row = await load()
  if (!row) throw new ExpertCancelError("not_found")
  // Pressed twice, two tabs, or the member cancelled first: nothing more
  // to do or to refund, and the caller is told so.
  if (row.status === "cancelled") {
    return { refundCents: 0, alreadyCancelled: true }
  }
  if (!EXPERT_CANCELLABLE_STATUSES.has(row.status)) {
    throw new ExpertCancelError("INVALID_STATUS")
  }
  if (
    input.expectedStartsAt &&
    input.expectedStartsAt.getTime() !== row.startsAt.getTime()
  ) {
    throw new ExpertCancelError("SESSION_CHANGED")
  }
  if (row.startsAt.getTime() <= now.getTime()) {
    throw new ExpertCancelError("TOO_LATE")
  }

  const refundCents =
    row.paymentStatus === "succeeded" && row.paymentAmountCents !== null
      ? row.paymentAmountCents - (row.paymentRefundedCents ?? 0)
      : 0

  try {
    await writeCancellation(row, {
      actorUserId: input.actorUserId,
      reason: input.reason,
      refundCents,
      now,
    })
  } catch (err) {
    // Lost a race with another press of the same button: same answer.
    if (err instanceof ExpertCancelError && err.code === "INVALID_STATUS") {
      const latest = await load()
      if (latest?.status === "cancelled") {
        return { refundCents: 0, alreadyCancelled: true }
      }
    }
    throw err
  }
  return { refundCents, alreadyCancelled: false }
}

/**
 * One transaction: the booking, the refund owed, the freed time, the event
 * and the audit row are written together or not at all. Each update is
 * guarded on what was read, so a change made meanwhile (the member moved or
 * cancelled, a refund started) fails the guard and nothing is written.
 */
async function writeCancellation(
  row: ExpertBookingApprovalRow,
  input: {
    actorUserId: string
    reason?: string
    refundCents: number
    now: Date
  }
): Promise<void> {
  const { refundCents, now } = input
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
            eq(main.bookings.orgId, row.orgId),
            eq(main.bookings.expertProfileId, row.expertProfileId),
            eq(main.bookings.status, row.status),
            eq(main.bookings.startsAt, row.startsAt)
          )
        )
        .returning({ id: main.bookings.id })
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
          // Nothing was paid for a free session: no percentage to record.
          ...(refundCents > 0 ? { refundPercent: 100 } : {}),
          refundCents,
        },
      })
    }
  )
}

/** `expert_cancel`, with the expert's own words after it when given. */
export function expertCancelReason(reason?: string): string {
  const trimmed = reason?.trim()
  if (!trimmed) return "expert_cancel"
  return `expert_cancel: ${trimmed.slice(0, REASON_MAX_LENGTH)}`
}
