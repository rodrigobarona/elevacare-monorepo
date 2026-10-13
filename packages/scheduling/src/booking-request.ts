import { and, eq, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  getExpertBookingForApproval,
  listExpiredBookingRequests,
  main,
  type ExpertBookingApprovalRow,
  type Tx,
} from "@eleva/db"
import { emitGuestActivationRequired } from "./confirm-booking"
import { emitBookingNotificationEvent } from "./emit-domain-event"
import { ensureSessionRow } from "./ensure-session-row"

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
  if (
    row.approvalDeadlineAt &&
    row.approvalDeadlineAt.getTime() <= now.getTime()
  ) {
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
  note?: string
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
    note: input.note,
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
    note?: string
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
      : truncateDeclineNote(input.note)

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

      if (
        row.paymentId &&
        row.paymentStatus === "succeeded" &&
        refundCents > 0
      ) {
        const [payment] = await tx
          .update(main.bookingPayments)
          .set({
            refundDueCents: (row.paymentRefundedCents ?? 0) + refundCents,
            status: "refund_pending",
          })
          .where(
            and(
              eq(main.bookingPayments.id, row.paymentId),
              eq(main.bookingPayments.status, "succeeded")
            )
          )
          .returning({ id: main.bookingPayments.id })
        if (!payment) {
          throw new BookingRequestError("INVALID_STATUS")
        }
      }

      if (row.reservationId) {
        await releaseReservationRow(tx, row.reservationId)
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
          refundCents,
        },
      })
    }
  )

  return { refundCents }
}

async function releaseReservationRow(tx: Tx, reservationId: string) {
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

function truncateDeclineNote(note?: string): string {
  const trimmed = note?.trim()
  if (!trimmed) return "expert_decline"
  return `expert_decline: ${trimmed.slice(0, 180)}`
}
