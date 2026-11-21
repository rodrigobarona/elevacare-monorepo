import {
  and,
  count,
  eq,
  gt,
  inArray,
  notExists,
  notInArray,
  sql,
} from "drizzle-orm"
import {
  PRACTICE_CLOSURE_BLOCKER_CODES,
  type PracticeClosureBlocker,
  type PracticeClosureBlockerCode,
} from "@eleva/config/practice-closure"
import type { Tx } from "../context"
import { member, organization } from "../schema/auth/index"
import * as main from "../schema/main"

/**
 * What still has to finish before an expert can close a practice
 * (ADR-026 decision 10); codes live in `@eleva/config/practice-closure`.
 */
export type PracticeClosureCounts = Record<PracticeClosureBlockerCode, number>

/**
 * Bookings in these states are over. They never block closing a practice
 * or removing a clinician from a clinic.
 */
export const FINISHED_BOOKING_STATUSES = [
  "cancelled",
  "completed",
  "no_show",
  "refunded",
] as const

/**
 * A slot a member is holding or paying for. It counts as a future booking:
 * confirming it creates one, so the practice cannot close underneath it.
 * Expired holds still count until the hold sweep releases them.
 */
export const LIVE_HOLD_STATUSES = ["active", "reserved"] as const

/**
 * Payouts still owed to the expert. `transferred` is settled from Eleva's
 * side (the money is in the expert's own Stripe account, which is kept);
 * `paid_out` and `reversed` are final.
 */
const UNSETTLED_PAYOUT_STATUSES = [
  "pending",
  "scheduled",
  "approval_required",
  "held",
  "failed",
  "reversal_pending",
] as const

const UNPAID_SUBSCRIPTION_STATUSES = ["past_due", "unpaid"] as const

async function countRows(query: Promise<{ value: number }[]>): Promise<number> {
  const [row] = await query
  return Number(row?.value ?? 0)
}

/**
 * Count each blocker for one organization. Run inside that org's context
 * (`withOrgContext` or `withAudit`) so RLS scopes every table to it.
 */
export async function countPracticeClosureBlockers(
  tx: Tx,
  orgId: string,
  now: Date = new Date()
): Promise<PracticeClosureCounts> {
  // Bookings and live holds in ONE statement, so both counts share one
  // snapshot: a hold being confirmed into a booking is seen as one or the
  // other, never as neither.
  const [scheduled] = await tx
    .select({
      bookings: sql<number>`(
        select count(*)::int from ${main.bookings}
        where ${and(
          eq(main.bookings.orgId, orgId),
          gt(main.bookings.startsAt, now),
          notInArray(main.bookings.status, [...FINISHED_BOOKING_STATUSES])
        )}
      )`,
      holds: sql<number>`(
        select count(*)::int from ${main.slotReservations}
        where ${and(
          eq(main.slotReservations.orgId, orgId),
          inArray(main.slotReservations.status, [...LIVE_HOLD_STATUSES])
        )}
      )`,
    })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.orgId, orgId))
    .limit(1)
  const bookings = Number(scheduled?.bookings ?? 0)
  const holds = Number(scheduled?.holds ?? 0)
  const refunds = await countRows(
    tx
      .select({ value: count() })
      .from(main.bookingRefunds)
      .where(
        and(
          eq(main.bookingRefunds.orgId, orgId),
          eq(main.bookingRefunds.status, "pending")
        )
      )
  )
  const paymentRefunds = await countRows(
    tx
      .select({ value: count() })
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.orgId, orgId),
          eq(main.bookingPayments.status, "refund_pending")
        )
      )
  )
  const reversals = await countRows(
    tx
      .select({ value: count() })
      .from(main.transferReversals)
      .where(
        and(
          eq(main.transferReversals.orgId, orgId),
          eq(main.transferReversals.status, "pending")
        )
      )
  )
  const disputes = await countRows(
    tx
      .select({ value: count() })
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.orgId, orgId),
          eq(main.bookingPayments.disputeStatus, "open")
        )
      )
  )
  const payouts = await countRows(
    tx
      .select({ value: count() })
      .from(main.payoutStates)
      .where(
        and(
          eq(main.payoutStates.orgId, orgId),
          inArray(main.payoutStates.status, [...UNSETTLED_PAYOUT_STATUSES])
        )
      )
  )
  const subscriptions = await countRows(
    tx
      .select({ value: count() })
      .from(main.billingSubscriptions)
      .where(
        and(
          eq(main.billingSubscriptions.orgId, orgId),
          inArray(main.billingSubscriptions.status, [
            ...UNPAID_SUBSCRIPTION_STATUSES,
          ])
        )
      )
  )
  return {
    FUTURE_BOOKINGS: bookings + holds,
    PENDING_REFUNDS: refunds + paymentRefunds + reversals,
    OPEN_DISPUTES: disputes,
    UNSETTLED_PAYOUTS: payouts,
    UNPAID_SUBSCRIPTION: subscriptions,
  }
}

/** The blockers that are still open, in a stable order. */
export function practiceClosureBlockers(
  counts: PracticeClosureCounts
): PracticeClosureBlocker[] {
  return PRACTICE_CLOSURE_BLOCKER_CODES.filter((code) => counts[code] > 0).map(
    (code) => ({ code, count: counts[code] })
  )
}

/**
 * Hold the expert profile row (shared lock) for the rest of this
 * transaction and say whether the practice is open. Closing updates that
 * row, so a reservation and a closure never interleave: either the hold
 * lands first and the closure's re-count sees it, or the closure lands
 * first and the reservation is refused.
 */
export async function lockOpenExpertProfile(
  tx: Tx,
  expertProfileId: string
): Promise<boolean> {
  const [row] = await tx
    .select({
      closedAt: main.expertProfiles.closedAt,
      orgId: main.expertProfiles.orgId,
      userId: main.expertProfiles.userId,
    })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.id, expertProfileId))
    .for("share")
  if (row === undefined || row.closedAt !== null) return false
  // A clinician removed from a clinic takes no new booking there. Removing
  // locks this same row first, so by the time the lock above is granted the
  // removal has committed; this second statement then sees it (its own
  // snapshot under READ COMMITTED). Solo practices are not affected.
  const [removed] = await tx
    .select({ id: organization.id })
    .from(organization)
    .where(
      and(
        eq(organization.id, row.orgId),
        eq(organization.type, "team"),
        notExists(
          tx
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.organizationId, row.orgId),
                eq(member.userId, row.userId)
              )
            )
        )
      )
    )
    .limit(1)
  return removed === undefined
}

/**
 * Take the profile rows of one person in one organization for update, for
 * the rest of this transaction. A reservation holds the same rows shared
 * (`lockOpenExpertProfile`), so a removal waits for holds in flight and
 * then counts them, and later reservations wait for the removal.
 */
export async function lockExpertProfilesForRemoval(
  tx: Tx,
  orgId: string,
  userId: string
): Promise<string[]> {
  const rows = await tx
    .select({ id: main.expertProfiles.id })
    .from(main.expertProfiles)
    .where(
      and(
        eq(main.expertProfiles.orgId, orgId),
        eq(main.expertProfiles.userId, userId)
      )
    )
    .for("update")
  return rows.map((row) => row.id)
}
