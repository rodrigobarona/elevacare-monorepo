import { and, eq, gt, inArray, isNull } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { auth, main, withPlatformAdminContext, type Tx } from "@eleva/db"
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  pseudonymiseBookingConsents,
} from "./retention"

export { ACCOUNT_DELETION_GRACE_DAYS }

const CANCELABLE_BOOKING_STATUSES = ["pending_payment"] as const
const REFUNDABLE_BOOKING_STATUSES = ["confirmed", "rescheduled"] as const
const CANCELABLE_PAYMENT_STATUSES = [
  "intent_pending",
  "requires_payment",
] as const
const SUCCEEDED_PAYMENT_STATUSES = ["succeeded"] as const

export class AccountDeletionConflictError extends Error {
  readonly code = "ACCOUNT_DELETION_ALREADY_SCHEDULED"

  constructor() {
    super("account deletion is already scheduled")
    this.name = "AccountDeletionConflictError"
  }
}

export class AccountDeletionNotPendingError extends Error {
  readonly code = "ACCOUNT_DELETION_NOT_PENDING"

  constructor() {
    super("no pending account deletion to cancel")
    this.name = "AccountDeletionNotPendingError"
  }
}

export type ScheduleAccountDeletionResult = {
  requestId: string
  scheduledFor: Date
  paymentIntentIds: string[]
}

async function cancelFutureBookingsInTx(
  tx: Tx,
  userId: string,
  now: Date
): Promise<string[]> {
  const pending = await tx
    .select({
      id: main.bookings.id,
      stripePaymentIntentId: main.bookings.stripePaymentIntentId,
      reservationId: main.bookings.reservationId,
      paymentStatus: main.bookingPayments.status,
    })
    .from(main.bookings)
    .leftJoin(
      main.bookingPayments,
      eq(main.bookingPayments.bookingId, main.bookings.id)
    )
    .where(
      and(
        eq(main.bookings.memberUserId, userId),
        inArray(main.bookings.status, [...CANCELABLE_BOOKING_STATUSES])
      )
    )

  const confirmed = await tx
    .select({
      id: main.bookings.id,
      paymentId: main.bookingPayments.id,
      paymentStatus: main.bookingPayments.status,
    })
    .from(main.bookings)
    .leftJoin(
      main.bookingPayments,
      eq(main.bookingPayments.bookingId, main.bookings.id)
    )
    .where(
      and(
        eq(main.bookings.memberUserId, userId),
        inArray(main.bookings.status, [...REFUNDABLE_BOOKING_STATUSES]),
        gt(main.bookings.startsAt, now)
      )
    )

  const cancelledAt = now
  const pendingIds = pending.map((row) => row.id)
  if (pendingIds.length > 0) {
    await tx
      .update(main.bookings)
      .set({
        status: "cancelled",
        cancellationReason: "account_deletion",
        cancelledAt,
        updatedAt: now,
      })
      .where(inArray(main.bookings.id, pendingIds))

    const reservationIds = pending
      .map((row) => row.reservationId)
      .filter((id): id is string => Boolean(id))
    if (reservationIds.length > 0) {
      await tx
        .update(main.slotReservations)
        .set({ status: "released" })
        .where(
          and(
            inArray(main.slotReservations.id, reservationIds),
            eq(main.slotReservations.status, "active")
          )
        )
    }
  }

  const confirmedIds = confirmed.map((row) => row.id)
  if (confirmedIds.length > 0) {
    await tx
      .update(main.bookings)
      .set({
        status: "cancelled",
        cancellationReason: "account_deletion",
        cancelledAt,
        updatedAt: now,
      })
      .where(inArray(main.bookings.id, confirmedIds))

    const refundPaymentIds = confirmed
      .filter(
        (row) =>
          row.paymentId &&
          row.paymentStatus &&
          (SUCCEEDED_PAYMENT_STATUSES as readonly string[]).includes(
            row.paymentStatus
          )
      )
      .map((row) => row.paymentId as string)
    if (refundPaymentIds.length > 0) {
      await tx
        .update(main.bookingPayments)
        .set({ status: "refund_pending" })
        .where(inArray(main.bookingPayments.id, refundPaymentIds))
    }
  }

  return pending
    .filter(
      (row) =>
        row.stripePaymentIntentId &&
        row.paymentStatus &&
        (CANCELABLE_PAYMENT_STATUSES as readonly string[]).includes(
          row.paymentStatus
        )
    )
    .map((row) => row.stripePaymentIntentId as string)
}

export async function scheduleAccountDeletion(input: {
  userId: string
  orgId: string
  graceDays?: number
}): Promise<ScheduleAccountDeletionResult> {
  const graceDays = input.graceDays ?? ACCOUNT_DELETION_GRACE_DAYS
  const now = new Date()
  const scheduledFor = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000)

  return withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const [existing] = await tx
        .select({ id: main.accountDeletionRequests.id })
        .from(main.accountDeletionRequests)
        .where(
          and(
            eq(main.accountDeletionRequests.userId, input.userId),
            eq(main.accountDeletionRequests.status, "pending")
          )
        )
        .limit(1)
      if (existing) {
        throw new AccountDeletionConflictError()
      }

      await tx
        .update(auth.user)
        .set({ deletionScheduledAt: now, updatedAt: now })
        .where(eq(auth.user.id, input.userId))

      const [request] = await tx
        .insert(main.accountDeletionRequests)
        .values({
          userId: input.userId,
          requestedAt: now,
          scheduledFor,
          status: "pending",
        })
        .returning({ id: main.accountDeletionRequests.id })

      const requestId = request!.id
      const paymentIntentIds = await cancelFutureBookingsInTx(
        tx,
        input.userId,
        now
      )

      await ctx.emit({
        entity: "account_deletion_request",
        action: "requested",
        entityId: requestId,
        payload: { scheduledFor: scheduledFor.toISOString() },
      })

      return { requestId, scheduledFor, paymentIntentIds }
    }
  )
}

export async function cancelAccountDeletion(input: {
  userId: string
  orgId: string
}): Promise<{ requestId: string }> {
  return withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const [request] = await tx
        .select({ id: main.accountDeletionRequests.id })
        .from(main.accountDeletionRequests)
        .where(
          and(
            eq(main.accountDeletionRequests.userId, input.userId),
            eq(main.accountDeletionRequests.status, "pending")
          )
        )
        .limit(1)
      if (!request) {
        throw new AccountDeletionNotPendingError()
      }

      await tx
        .update(auth.user)
        .set({ deletionScheduledAt: null, updatedAt: new Date() })
        .where(eq(auth.user.id, input.userId))

      await tx
        .update(main.accountDeletionRequests)
        .set({ status: "cancelled" })
        .where(eq(main.accountDeletionRequests.id, request.id))

      await ctx.emit({
        entity: "account_deletion_request",
        action: "canceled",
        entityId: request.id,
        payload: {},
      })

      return { requestId: request.id }
    }
  )
}

export type AccountDeletionSweepResult = {
  raced: number
  completed: number
  paymentIntentIds: string[]
}

export async function sweepAccountDeletions(
  now: Date = new Date()
): Promise<AccountDeletionSweepResult> {
  const pending = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: main.accountDeletionRequests.id,
        userId: main.accountDeletionRequests.userId,
        orgId: auth.member.organizationId,
        scheduledFor: main.accountDeletionRequests.scheduledFor,
      })
      .from(main.accountDeletionRequests)
      .innerJoin(
        auth.member,
        eq(auth.member.userId, main.accountDeletionRequests.userId)
      )
      .innerJoin(
        auth.organization,
        eq(auth.organization.id, auth.member.organizationId)
      )
      .where(
        and(
          eq(main.accountDeletionRequests.status, "pending"),
          eq(auth.organization.type, "personal")
        )
      )
  )

  const result: AccountDeletionSweepResult = {
    raced: 0,
    completed: 0,
    paymentIntentIds: [],
  }
  const seen = new Set<string>()

  for (const row of pending) {
    if (seen.has(row.id)) continue
    seen.add(row.id)

    const due = row.scheduledFor.getTime() <= now.getTime()
    const paymentIntentIds = await withPlatformAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        const ids = await cancelFutureBookingsInTx(tx, row.userId, now)
        if (due) {
          await tx
            .delete(main.consents)
            .where(
              and(
                eq(main.consents.userId, row.userId),
                isNull(main.consents.bookingId)
              )
            )
          await pseudonymiseBookingConsents(row.userId, tx)
          await tx
            .update(main.accountDeletionRequests)
            .set({ status: "completed" })
            .where(eq(main.accountDeletionRequests.id, row.id))
        }
        await ctx.emit({
          entity: "account_deletion_request",
          action: due ? "status_changed" : "updated",
          entityId: row.id,
          payload: due
            ? { status: "completed", raceCatch: true }
            : {
                raceCatch: true,
                cancelledIntents: ids.length,
              },
        })
        return ids
      }
    )
    result.raced += paymentIntentIds.length
    result.paymentIntentIds.push(...paymentIntentIds)
    if (due) result.completed += 1
  }

  return result
}
