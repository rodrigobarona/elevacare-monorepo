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
  const [futureBookings, refunds, paymentRefunds, reversals, disputes] =
    await Promise.all([
      countRows(
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
      ),
      countRows(
        tx
          .select({ value: count() })
          .from(main.bookingRefunds)
          .where(
            and(
              eq(main.bookingRefunds.orgId, orgId),
              eq(main.bookingRefunds.status, "pending")
            )
          )
      ),
      countRows(
        tx
          .select({ value: count() })
          .from(main.bookingPayments)
          .where(
            and(
              eq(main.bookingPayments.orgId, orgId),
              eq(main.bookingPayments.status, "refund_pending")
            )
          )
      ),
      countRows(
        tx
          .select({ value: count() })
          .from(main.transferReversals)
          .where(
            and(
              eq(main.transferReversals.orgId, orgId),
              eq(main.transferReversals.status, "pending")
            )
          )
      ),
      countRows(
        tx
          .select({ value: count() })
          .from(main.bookingPayments)
          .where(
            and(
              eq(main.bookingPayments.orgId, orgId),
              eq(main.bookingPayments.disputeStatus, "open")
            )
          )
      ),
    ])
  const [payouts, subscriptions] = await Promise.all([
    countRows(
      tx
        .select({ value: count() })
        .from(main.payoutStates)
        .where(
          and(
            eq(main.payoutStates.orgId, orgId),
            inArray(main.payoutStates.status, [...UNSETTLED_PAYOUT_STATUSES])
          )
        )
    ),
    countRows(
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
    ),
  ])
  return {
    FUTURE_BOOKINGS: futureBookings,
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
