import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { auth, main, withPlatformAdminContext, type Tx } from "@eleva/db"
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  pseudonymiseBookingConsents,
} from "./retention"

export { ACCOUNT_DELETION_GRACE_DAYS }

const ANONYMISED_ACCOUNT_NAME = "Deleted member"
const ANONYMISED_BAN_REASON = "account_deleted"

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

async function lockAccountDeletionUser(tx: Tx, userId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`account-deletion:${userId}`}))`
  )
}

export function anonymisedAccountEmail(userId: string): string {
  return `deleted+${userId}@deleted.invalid`
}

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined
  }
  return false
}

async function eraseAccountRecord(
  tx: Tx,
  userId: string,
  now: Date
): Promise<void> {
  await tx.delete(auth.session).where(eq(auth.session.userId, userId))
  await tx
    .update(auth.account)
    .set({
      accessToken: null,
      refreshToken: null,
      idToken: null,
      password: null,
      updatedAt: now,
    })
    .where(eq(auth.account.userId, userId))
  await tx
    .update(auth.user)
    .set({
      name: ANONYMISED_ACCOUNT_NAME,
      email: anonymisedAccountEmail(userId),
      emailVerified: false,
      image: null,
      timezone: null,
      locale: null,
      banned: true,
      banReason: ANONYMISED_BAN_REASON,
      updatedAt: now,
    })
    .where(eq(auth.user.id, userId))
}

function uniquePaymentIntentIds(ids: readonly (string | null)[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  return unique
}

async function collectCancelablePaymentIntentIds(
  tx: Tx,
  userId: string
): Promise<string[]> {
  const rows = await tx
    .select({
      stripePaymentIntentId: main.bookings.stripePaymentIntentId,
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
        eq(main.bookings.cancellationReason, "account_deletion"),
        eq(main.bookings.status, "cancelled")
      )
    )

  return uniquePaymentIntentIds(
    rows
      .filter(
        (row) =>
          row.stripePaymentIntentId &&
          row.paymentStatus &&
          (CANCELABLE_PAYMENT_STATUSES as readonly string[]).includes(
            row.paymentStatus
          )
      )
      .map((row) => row.stripePaymentIntentId)
  )
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

  return collectCancelablePaymentIntentIds(tx, userId)
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
      await lockAccountDeletionUser(tx, input.userId)
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

      let request: { id: string } | undefined
      try {
        const inserted = await tx
          .insert(main.accountDeletionRequests)
          .values({
            userId: input.userId,
            requestedAt: now,
            scheduledFor,
            status: "pending",
          })
          .returning({ id: main.accountDeletionRequests.id })
        request = inserted[0]
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new AccountDeletionConflictError()
        }
        throw err
      }

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
      await lockAccountDeletionUser(tx, input.userId)
      const now = new Date()
      const [request] = await tx
        .update(main.accountDeletionRequests)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(main.accountDeletionRequests.userId, input.userId),
            eq(main.accountDeletionRequests.status, "pending"),
            gt(main.accountDeletionRequests.scheduledFor, now)
          )
        )
        .returning({ id: main.accountDeletionRequests.id })
      if (!request) {
        throw new AccountDeletionNotPendingError()
      }

      await tx
        .update(auth.user)
        .set({ deletionScheduledAt: null, updatedAt: new Date() })
        .where(eq(auth.user.id, input.userId))

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

export type AccountDeletionAwaitingCompletion = {
  id: string
  userId: string
  orgId: string
}

export type AccountDeletionSweepResult = {
  raced: number
  completed: number
  paymentIntentIds: string[]
  awaitingCompletion: AccountDeletionAwaitingCompletion[]
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
    awaitingCompletion: [],
  }
  const seen = new Set<string>()

  for (const row of pending) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    if (!row.userId) continue
    const userId = row.userId

    const due = row.scheduledFor.getTime() <= now.getTime()
    const swept = await withPlatformAudit(
      { orgId: row.orgId, actorUserId: userId },
      async (tx, ctx) => {
        await lockAccountDeletionUser(tx, userId)
        const [claimed] = await tx
          .select({ id: main.accountDeletionRequests.id })
          .from(main.accountDeletionRequests)
          .where(
            and(
              eq(main.accountDeletionRequests.id, row.id),
              eq(main.accountDeletionRequests.status, "pending")
            )
          )
          .limit(1)
        if (!claimed) {
          return {
            ids: [] as string[],
            completed: false,
            awaitingCompletion: false,
          }
        }

        const ids = await cancelFutureBookingsInTx(tx, userId, now)
        if (due) {
          await tx
            .delete(main.consents)
            .where(
              and(
                eq(main.consents.userId, userId),
                isNull(main.consents.bookingId)
              )
            )
          await pseudonymiseBookingConsents(userId, tx)
          await tx
            .delete(main.notificationPreferences)
            .where(eq(main.notificationPreferences.userId, userId))
          await eraseAccountRecord(tx, userId, now)
          if (ids.length === 0) {
            const [completed] = await tx
              .update(main.accountDeletionRequests)
              .set({ status: "completed" })
              .where(
                and(
                  eq(main.accountDeletionRequests.id, row.id),
                  eq(main.accountDeletionRequests.status, "pending")
                )
              )
              .returning({ id: main.accountDeletionRequests.id })
            if (!completed) {
              return {
                ids: [] as string[],
                completed: false,
                awaitingCompletion: false,
              }
            }
          }
        }
        await ctx.emit({
          entity: "account_deletion_request",
          action: due && ids.length === 0 ? "status_changed" : "updated",
          entityId: row.id,
          payload: due
            ? {
                status: ids.length === 0 ? "completed" : "pending",
                accountAnonymised: true,
                awaitingPaymentCancel: ids.length > 0,
                raceCatch: true,
              }
            : {
                raceCatch: true,
                cancelledIntents: ids.length,
              },
        })
        return {
          ids,
          completed: due && ids.length === 0,
          awaitingCompletion: due && ids.length > 0,
        }
      }
    )
    result.raced += swept.ids.length
    result.paymentIntentIds.push(...swept.ids)
    if (swept.completed) result.completed += 1
    if (swept.awaitingCompletion) {
      result.awaitingCompletion.push({
        id: row.id,
        userId,
        orgId: row.orgId,
      })
    }
  }

  return result
}

export async function completeSweptAccountDeletions(
  requests: readonly AccountDeletionAwaitingCompletion[]
): Promise<number> {
  let completed = 0
  for (const row of requests) {
    const done = await withPlatformAudit(
      { orgId: row.orgId, actorUserId: row.userId },
      async (tx, ctx) => {
        await lockAccountDeletionUser(tx, row.userId)
        const [updated] = await tx
          .update(main.accountDeletionRequests)
          .set({ status: "completed" })
          .where(
            and(
              eq(main.accountDeletionRequests.id, row.id),
              eq(main.accountDeletionRequests.status, "pending")
            )
          )
          .returning({ id: main.accountDeletionRequests.id })
        if (!updated) return false
        await ctx.emit({
          entity: "account_deletion_request",
          action: "status_changed",
          entityId: row.id,
          payload: { status: "completed", accountAnonymised: true },
        })
        return true
      }
    )
    if (done) completed += 1
  }
  return completed
}
