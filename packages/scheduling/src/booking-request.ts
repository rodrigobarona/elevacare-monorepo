import { and, eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  EXPERT_DECLINE_REASONS,
  type ExpertDeclineReason,
} from "@eleva/config/cancellation-policy"
import {
  getExpertBookingForApproval,
  listExpiredBookingRequests,
  main,
  type ExpertBookingApprovalRow,
} from "@eleva/db"
import { emitGuestActivationRequired } from "./confirm-booking"
import { emitBookingNotificationEvent } from "./emit-domain-event"
import { ensureSessionRow } from "./ensure-session-row"
import { markRefundDue, releaseReservation } from "./refund-due"

export type BookingRequestErrorCode =
  | "not_found"
  | "INVALID_STATUS"
  | "REQUEST_EXPIRED"

export class BookingRequestError extends Error {
  readonly code: BookingRequestErrorCode

  constructor(code: BookingRequestErrorCode) {
    super(code)
    this.name = "BookingRequestError"
    this.code = code
  }
}

export async function acceptBookingRequest(input: {
  actorUserId: string
  orgId: string
  expertProfileId: string
  bookingId: string
  now?: Date
}): Promise<{ bookingId: string }> {
  const now = input.now ?? new Date()
  const row = await getExpertBookingForApproval({
    orgId: input.orgId,
    expertProfileId: input.expertProfileId,
    bookingId: input.bookingId,
  })
  if (!row) throw new BookingRequestError("not_found")
  if (row.status !== "awaiting_confirmation") {
    if (row.status === "confirmed") return { bookingId: row.id }
    throw new BookingRequestError("INVALID_STATUS")
  }
  const deadline = row.approvalDeadlineAt ?? row.startsAt
  if (deadline.getTime() <= now.getTime()) {
    throw new BookingRequestError("REQUEST_EXPIRED")
  }

  await withAudit(
    { orgId: row.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [updated] = await tx
        .update(main.bookings)
        .set({
          status: "confirmed",
          confirmedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(main.bookings.id, row.id),
            eq(main.bookings.status, "awaiting_confirmation")
          )
        )
        .returning({ id: main.bookings.id })
      if (!updated) {
        throw new BookingRequestError("INVALID_STATUS")
      }

      if (row.reservationId) {
        await emitGuestActivationRequired(tx, {
          orgId: row.orgId,
          bookingId: row.id,
          reservationId: row.reservationId,
        })
      }
      await ensureSessionRow(tx, {
        id: row.id,
        orgId: row.orgId,
        eventTypeId: row.eventTypeId,
        expertProfileId: row.expertProfileId,
        memberUserId: row.memberUserId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        sessionMode: row.sessionMode,
      })
      await emitBookingNotificationEvent(tx, {
        orgId: row.orgId,
        type: "booking.request_accepted",
        bookingId: row.id,
        startsAt: row.startsAt,
        occurredAt: now,
      })
      await ctx.emit({
        entity: "booking",
        action: "approved",
        entityId: row.id,
        payload: { from: "awaiting_confirmation", to: "confirmed" },
      })
    }
  )

  return { bookingId: row.id }
}

export async function declineBookingRequest(input: {
  actorUserId: string | null
  orgId: string
  expertProfileId: string
  bookingId: string
  /** One of a fixed list, kept on the booking record; not sent to the member. */
  reason?: ExpertDeclineReason
  source: "expert" | "expiry"
  now?: Date
}): Promise<{ refundCents: number }> {
  const now = input.now ?? new Date()
  const row = await getExpertBookingForApproval({
    orgId: input.orgId,
    expertProfileId: input.expertProfileId,
    bookingId: input.bookingId,
  })
  if (!row) throw new BookingRequestError("not_found")
  if (row.status !== "awaiting_confirmation") {
    if (row.status === "cancelled") return { refundCents: 0 }
    throw new BookingRequestError("INVALID_STATUS")
  }
  return settleDeclinedRequest(row, {
    actorUserId: input.actorUserId,
    reason: input.reason,
    source: input.source,
    now,
  })
}

export async function expireBookingRequests(input?: {
  now?: Date
  limit?: number
}): Promise<{ scanned: number; expired: number; errors: number }> {
  const now = input?.now ?? new Date()
  const rows = await listExpiredBookingRequests({
    now,
    limit: input?.limit ?? 100,
  })
  let expired = 0
  let errors = 0
  for (const row of rows) {
    try {
      await settleDeclinedRequest(row, {
        actorUserId: null,
        source: "expiry",
        now,
      })
      expired += 1
    } catch (err) {
      if (err instanceof BookingRequestError && err.code === "INVALID_STATUS") {
        continue
      }
      console.error("[booking-request-expiry] decline failed", {
        bookingId: row.id,
        err,
      })
      errors += 1
    }
  }
  return { scanned: rows.length, expired, errors }
}

async function settleDeclinedRequest(
  row: ExpertBookingApprovalRow,
  input: {
    actorUserId: string | null
    reason?: ExpertDeclineReason
    source: "expert" | "expiry"
    now: Date
  }
): Promise<{ refundCents: number }> {
  const refundCents =
    row.paymentStatus === "succeeded" && row.paymentAmountCents !== null
      ? row.paymentAmountCents - (row.paymentRefundedCents ?? 0)
      : 0
  const reason =
    input.source === "expiry"
      ? "request_expired"
      : expertDeclineReason(input.reason)

  await withAudit(
    { orgId: row.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [updated] = await tx
        .update(main.bookings)
        .set({
          status: "cancelled",
          cancellationReason: reason,
          cancelledAt: input.now,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(main.bookings.id, row.id),
            eq(main.bookings.status, "awaiting_confirmation")
          )
        )
        .returning({ id: main.bookings.id })
      if (!updated) {
        throw new BookingRequestError("INVALID_STATUS")
      }

      if (row.paymentId && refundCents > 0) {
        const marked = await markRefundDue(tx, {
          paymentId: row.paymentId,
          refundedCents: row.paymentRefundedCents ?? 0,
          refundCents,
        })
        if (!marked) throw new BookingRequestError("INVALID_STATUS")
      }

      if (row.reservationId) {
        await releaseReservation(tx, row.reservationId)
      }

      await emitBookingNotificationEvent(tx, {
        orgId: row.orgId,
        type:
          input.source === "expiry"
            ? "booking.request_expired"
            : "booking.request_declined",
        bookingId: row.id,
        startsAt: row.startsAt,
        occurredAt: input.now,
        ...(refundCents > 0 ? { refundCents } : {}),
      })
      await ctx.emit({
        entity: "booking",
        action: input.source === "expiry" ? "canceled" : "rejected",
        entityId: row.id,
        payload: {
          reason:
            input.source === "expiry" ? "request_expired" : "expert_decline",
          ...(input.source === "expert" && input.reason
            ? { reasonCode: input.reason }
            : {}),
          refundCents,
        },
      })
    }
  )

  return { refundCents }
}

/** `expert_decline`, or `expert_decline:<reason>` for a reason from the list. */
export function expertDeclineReason(reason?: string): string {
  return (EXPERT_DECLINE_REASONS as readonly string[]).includes(reason ?? "")
    ? `expert_decline:${reason}`
    : "expert_decline"
}
