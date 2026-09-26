import { and, eq, ne, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  cancellationRefundCents,
  resolveCancellationRefund,
  type CancellationRefundQuote,
} from "@eleva/config/cancellation-policy"
import {
  getExpertScheduleForBooking,
  getMemberBookingForPolicy,
  listExpertBusyBookings,
  main,
  withOrgContext,
  type MemberBookingPolicyRow,
  type Tx,
} from "@eleva/db"
import { assertRequestedSlotAvailable } from "./assert-slot-available"
import { canReschedule } from "./booking-rules"
import { emitBookingNotificationEvent } from "./emit-domain-event"
import { resolveOffer } from "./resolve-offer"

const MUTABLE_STATUSES = new Set(["confirmed", "rescheduled"])

export type MemberBookingPolicyErrorCode =
  | "not_found"
  | "POLICY_TOO_LATE"
  | "INVALID_STATUS"
  | "SLOT_TAKEN"

export class MemberBookingPolicyError extends Error {
  readonly code: MemberBookingPolicyErrorCode

  constructor(code: MemberBookingPolicyErrorCode) {
    super(code)
    this.name = "MemberBookingPolicyError"
    this.code = code
  }
}

export type MemberIcsPayload = {
  expertEmail: string
  expertName: string
  memberName: string
  memberEmail: string
  eventTypeName: string
  bookingId: string
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: string
  locale?: "en" | "pt" | "es"
  sequence?: number
}

function eventTitle(
  title: { en: string; pt?: string; es?: string },
  locale: string | null
): string {
  if (locale === "pt" && title.pt) return title.pt
  if (locale === "es" && title.es) return title.es
  return title.en
}

function icsLocale(value: string | null): "en" | "pt" | "es" | undefined {
  if (value === "pt" || value === "es" || value === "en") return value
  return undefined
}

function toIcsPayload(
  row: MemberBookingPolicyRow,
  times?: { startsAt: Date; endsAt: Date },
  sequence?: number
): MemberIcsPayload {
  return {
    expertEmail: row.expertEmail,
    expertName: row.expertName,
    memberName: row.memberName ?? row.guestName ?? "Member",
    memberEmail: row.memberEmail ?? row.guestEmail ?? "",
    eventTypeName: eventTitle(row.eventTypeName, row.bookedLocale),
    bookingId: row.id,
    startsAt: times?.startsAt ?? row.startsAt,
    endsAt: times?.endsAt ?? row.endsAt,
    timezone: row.timezone,
    sessionMode: row.sessionMode,
    locale: icsLocale(row.bookedLocale),
    sequence,
  }
}

export type MemberCancellationQuote = CancellationRefundQuote & {
  /** What the member gets back now; 0 for unpaid bookings. */
  refundCents: number
  currency: string
}

function quoteFor(
  row: MemberBookingPolicyRow,
  now: Date
): MemberCancellationQuote {
  const quote = resolveCancellationRefund({
    policy: row.cancellationPolicy,
    bookedAt: row.bookedAt,
    startsAt: row.startsAt,
    now,
  })
  const refundable =
    row.paymentStatus === "succeeded" && row.paymentAmountCents !== null
      ? row.paymentAmountCents - (row.paymentRefundedCents ?? 0)
      : 0
  return {
    ...quote,
    refundCents: cancellationRefundCents(refundable, quote.refundPercent),
    currency: row.currency,
  }
}

async function loadMutableBooking(input: {
  userId: string
  orgId: string
  bookingId: string
  now: Date
}): Promise<MemberBookingPolicyRow> {
  const row = await getMemberBookingForPolicy({
    userId: input.userId,
    bookingId: input.bookingId,
    orgId: input.orgId,
  })
  if (!row) throw new MemberBookingPolicyError("not_found")
  if (!MUTABLE_STATUSES.has(row.status)) {
    throw new MemberBookingPolicyError("INVALID_STATUS")
  }
  if (row.startsAt.getTime() <= input.now.getTime()) {
    throw new MemberBookingPolicyError("POLICY_TOO_LATE")
  }
  return row
}

/** What cancelling right now would refund, under the booking's snapshot policy. */
export async function quoteMemberCancellation(input: {
  userId: string
  orgId: string
  bookingId: string
  now?: Date
}): Promise<MemberCancellationQuote> {
  const now = input.now ?? new Date()
  const row = await loadMutableBooking({ ...input, now })
  return quoteFor(row, now)
}

export async function cancelMemberBooking(input: {
  userId: string
  orgId: string
  bookingId: string
  now?: Date
}): Promise<{ ics: MemberIcsPayload; refund: MemberCancellationQuote }> {
  const now = input.now ?? new Date()
  const row = await loadMutableBooking({ ...input, now })
  const refund = quoteFor(row, now)

  await withAudit(
    { orgId: row.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const [updated] = await tx
        .update(main.bookings)
        .set({
          status: "cancelled",
          cancellationReason: "member_cancel",
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
      if (!updated) {
        throw new MemberBookingPolicyError("INVALID_STATUS")
      }

      if (row.paymentId && row.paymentStatus === "succeeded") {
        // refund_due_cents is the cumulative refunded total the payment must
        // reach; at 0% the payment stays succeeded and the expert is paid.
        const [payment] = await tx
          .update(main.bookingPayments)
          .set({
            refundDueCents:
              (row.paymentRefundedCents ?? 0) + refund.refundCents,
            ...(refund.refundCents > 0
              ? { status: "refund_pending" as const }
              : {}),
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
        if (!payment) {
          throw new MemberBookingPolicyError("INVALID_STATUS")
        }
      }

      if (row.reservationId) {
        await tx
          .update(main.slotReservations)
          .set({ status: "released" })
          .where(
            and(
              eq(main.slotReservations.id, row.reservationId),
              eq(main.slotReservations.status, "active")
            )
          )
      }

      await emitBookingNotificationEvent(tx, {
        orgId: row.orgId,
        type: "booking.cancelled",
        bookingId: row.id,
        startsAt: row.startsAt,
        occurredAt: now,
      })
      await ctx.emit({
        entity: "booking",
        action: "canceled",
        entityId: row.id,
        payload: {
          reason: "member_cancel",
          policy: refund.policy,
          policyVersion: row.cancellationPolicyVersion,
          refundPercent: refund.refundPercent,
          refundCents: refund.refundCents,
          refundBasis: refund.reason,
        },
      })
    }
  )

  return { ics: toIcsPayload(row), refund }
}

export async function rescheduleMemberBooking(input: {
  userId: string
  orgId: string
  bookingId: string
  startsAt: Date
  endsAt: Date
  now?: Date
}): Promise<{ ics: MemberIcsPayload; previousStartsAt: Date }> {
  const now = input.now ?? new Date()
  const row = await loadMutableBooking({ ...input, now })
  // Moving a session out of its penalty window would dodge the policy, so
  // members can only reschedule while cancelling would still refund in full.
  if (
    quoteFor(row, now).refundPercent < 100 ||
    !canReschedule(row.rescheduleWindowHours, row.startsAt, now)
  ) {
    throw new MemberBookingPolicyError("POLICY_TOO_LATE")
  }

  const duration = row.endsAt.getTime() - row.startsAt.getTime()
  if (input.endsAt.getTime() - input.startsAt.getTime() !== duration) {
    throw new MemberBookingPolicyError("INVALID_STATUS")
  }
  if (input.startsAt.getTime() <= now.getTime()) {
    throw new MemberBookingPolicyError("POLICY_TOO_LATE")
  }

  await assertDestinationAvailable(row, input.startsAt, input.endsAt, now)

  await withAudit(
    { orgId: row.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const taken = await slotTaken(tx, {
        expertProfileId: row.expertProfileId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        excludeBookingId: row.id,
      })
      if (taken) {
        throw new MemberBookingPolicyError("SLOT_TAKEN")
      }

      const [updated] = await tx
        .update(main.bookings)
        .set({
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: "rescheduled",
          updatedAt: now,
          scheduleRevision: sql`${main.bookings.scheduleRevision} + 1`,
        })
        .where(
          and(
            eq(main.bookings.id, row.id),
            eq(main.bookings.status, row.status),
            eq(main.bookings.startsAt, row.startsAt)
          )
        )
        .returning({
          id: main.bookings.id,
          scheduleRevision: main.bookings.scheduleRevision,
        })
      if (!updated) {
        throw new MemberBookingPolicyError("INVALID_STATUS")
      }

      await emitBookingNotificationEvent(tx, {
        orgId: row.orgId,
        type: "booking.rescheduled",
        bookingId: row.id,
        startsAt: input.startsAt,
        previousStartsAt: row.startsAt,
        occurredAt: now,
        scheduleRevision: updated.scheduleRevision,
      })
      await ctx.emit({
        entity: "booking",
        action: "rescheduled",
        entityId: row.id,
        payload: {
          from: row.startsAt.toISOString(),
          to: input.startsAt.toISOString(),
        },
      })
    }
  )

  return {
    ics: toIcsPayload(
      row,
      { startsAt: input.startsAt, endsAt: input.endsAt },
      1
    ),
    previousStartsAt: row.startsAt,
  }
}

async function assertDestinationAvailable(
  row: MemberBookingPolicyRow,
  startsAt: Date,
  endsAt: Date,
  now: Date
): Promise<void> {
  if (!row.eventTypeModeId) {
    throw new MemberBookingPolicyError("SLOT_TAKEN")
  }

  const offerResult = await resolveOffer({
    expertOrgId: row.orgId,
    eventTypeModeId: row.eventTypeModeId,
  })
  if (!offerResult.ok) {
    throw new MemberBookingPolicyError("SLOT_TAKEN")
  }

  const scheduleData = await getExpertScheduleForBooking(row.expertProfileId)
  if (!scheduleData.schedule) {
    throw new MemberBookingPolicyError("SLOT_TAKEN")
  }

  const existingBookings = await listExpertBusyBookings(
    row.expertProfileId,
    new Date(startsAt.getTime() - 36 * 60 * 60 * 1000),
    new Date(endsAt.getTime() + 36 * 60 * 60 * 1000)
  )
  const busy = existingBookings.filter(
    (interval) =>
      interval.start.getTime() !== row.startsAt.getTime() ||
      interval.end.getTime() !== row.endsAt.getTime()
  )

  const available = assertRequestedSlotAvailable({
    offer: offerResult.offer,
    startsAt,
    endsAt,
    schedule: { timezone: scheduleData.schedule.timezone },
    rules: scheduleData.rules,
    overrides: scheduleData.overrides,
    existingBookings: busy,
    now,
  })
  if (!available.ok) {
    throw new MemberBookingPolicyError("SLOT_TAKEN")
  }
}

async function slotTaken(
  tx: Tx,
  input: {
    expertProfileId: string
    startsAt: Date
    endsAt: Date
    excludeBookingId: string
  }
): Promise<boolean> {
  const now = new Date()
  const [hold] = await tx
    .select({ id: main.slotReservations.id })
    .from(main.slotReservations)
    .where(
      and(
        eq(main.slotReservations.expertProfileId, input.expertProfileId),
        eq(main.slotReservations.status, "active"),
        sql`${main.slotReservations.expiresAt} > ${now}`,
        sql`${main.slotReservations.startsAt} < ${input.endsAt}`,
        sql`${main.slotReservations.endsAt} > ${input.startsAt}`
      )
    )
    .limit(1)
  if (hold) return true

  const [booking] = await tx
    .select({ id: main.bookings.id })
    .from(main.bookings)
    .where(
      and(
        eq(main.bookings.expertProfileId, input.expertProfileId),
        ne(main.bookings.id, input.excludeBookingId),
        sql`${main.bookings.status} NOT IN ('cancelled', 'no_show')`,
        sql`${main.bookings.startsAt} < ${input.endsAt}`,
        sql`${main.bookings.endsAt} > ${input.startsAt}`
      )
    )
    .limit(1)
  return Boolean(booking)
}

/** Exported for tests that need to run the overlap check inside a mocked tx. */
export async function assertRescheduleSlotFree(
  orgId: string,
  input: {
    expertProfileId: string
    startsAt: Date
    endsAt: Date
    excludeBookingId: string
  }
): Promise<void> {
  const taken = await withOrgContext(orgId, (tx) => slotTaken(tx, input))
  if (taken) throw new MemberBookingPolicyError("SLOT_TAKEN")
}
