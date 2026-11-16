import { and, count, eq, gt, inArray, notInArray } from "drizzle-orm"
import {
  PRACTICE_CLOSURE_BLOCKER_CODES,
  type PracticeClosureBlocker,
  type PracticeClosureBlockerCode,
} from "@eleva/config/practice-closure"
import type { Tx } from "../context"
import * as main from "../schema/main"

/**
 * What still has to finish before an expert can close a practice
 * (ADR-026 decision 10); codes live in `@eleva/config/practice-closure`.
 */
export type PracticeClosureCounts = Record<PracticeClosureBlockerCode, number>

/** Bookings in these states are over and never block a closure. */
const FINISHED_BOOKING_STATUSES = [
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
const LIVE_HOLD_STATUSES = ["active", "reserved"] as const

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
  const bookings = await countRows(
    tx
      .select({ value: count() })
      .from(main.bookings)
      .where(
        and(
          eq(main.bookings.orgId, orgId),
          gt(main.bookings.startsAt, now),
          notInArray(main.bookings.status, [...FINISHED_BOOKING_STATUSES])
        )
      )
  )
  const holds = await countRows(
    tx
      .select({ value: count() })
      .from(main.slotReservations)
      .where(
        and(
          eq(main.slotReservations.orgId, orgId),
          inArray(main.slotReservations.status, [...LIVE_HOLD_STATUSES])
        )
      )
  )
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
    .select({ closedAt: main.expertProfiles.closedAt })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.id, expertProfileId))
    .for("share")
  return row !== undefined && row.closedAt === null
}
