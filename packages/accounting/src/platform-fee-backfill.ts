/**
 * Backfills the Tier 1 platform-fee ledger for succeeded payments whose
 * webhook-time `issuePlatformFeeInvoice` call threw before a
 * `platform_fee_invoices` row existed. Existing rows (including `pending`)
 * are left alone so re-runs never re-emit closed-gate domain events.
 * The closed issuance gate still applies: nothing here POSTs to TOConline.
 */

import { and, eq, gte, lte, notExists } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import {
  issuePlatformFeeInvoice,
  type PlatformFeeIssuanceOutcome,
} from "./platform-fee-issue"

export const PLATFORM_FEE_BACKFILL_WORKFLOW_NAME = "platform-fee-backfill"
export const PLATFORM_FEE_BACKFILL_BATCH_SIZE = 50
// Leaves the webhook time to write the row itself before the sweep races it.
export const PLATFORM_FEE_BACKFILL_MIN_AGE_MS = 30 * 60 * 1000
// Older payments predate the ledger and are covered by D-09 legacy rows.
export const PLATFORM_FEE_BACKFILL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000

export type PlatformFeeBackfillResult = {
  scanned: number
  recorded: Record<PlatformFeeIssuanceOutcome, number>
  deadLettered: number
  errors: number
}

export function emptyPlatformFeeBackfillResult(): PlatformFeeBackfillResult {
  return {
    scanned: 0,
    recorded: { skipped: 0, blocked: 0, pending: 0, already_recorded: 0 },
    deadLettered: 0,
    errors: 0,
  }
}

export async function backfillMissingPlatformFeeInvoices(
  options: {
    now?: Date
    batchSize?: number
    minAgeMs?: number
    lookbackMs?: number
  } = {}
): Promise<PlatformFeeBackfillResult> {
  const result = emptyPlatformFeeBackfillResult()
  if (!(await getFlag("ff.toconline_invoicing_enabled"))) return result

  const now = options.now ?? new Date()
  const newest = new Date(
    now.getTime() - (options.minAgeMs ?? PLATFORM_FEE_BACKFILL_MIN_AGE_MS)
  )
  const oldest = new Date(
    now.getTime() - (options.lookbackMs ?? PLATFORM_FEE_BACKFILL_LOOKBACK_MS)
  )

  const candidates = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        id: main.bookingPayments.id,
        orgId: main.bookingPayments.orgId,
      })
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.status, "succeeded"),
          gte(main.bookingPayments.paidAt, oldest),
          lte(main.bookingPayments.paidAt, newest),
          notExists(
            tx
              .select({ id: main.workflowDeadLetters.id })
              .from(main.workflowDeadLetters)
              .where(
                and(
                  eq(
                    main.workflowDeadLetters.workflowName,
                    PLATFORM_FEE_BACKFILL_WORKFLOW_NAME
                  ),
                  eq(
                    main.workflowDeadLetters.entityId,
                    main.bookingPayments.id
                  ),
                  eq(main.workflowDeadLetters.status, "open")
                )
              )
          ),
          notExists(
            tx
              .select({ id: main.platformFeeInvoices.id })
              .from(main.platformFeeInvoices)
              .where(
                eq(
                  main.platformFeeInvoices.bookingPaymentId,
                  main.bookingPayments.id
                )
              )
          )
        )
      )
      .orderBy(main.bookingPayments.paidAt, main.bookingPayments.id)
      .limit(options.batchSize ?? PLATFORM_FEE_BACKFILL_BATCH_SIZE)
  )

  result.scanned = candidates.length
  for (const payment of candidates) {
    let reason: string
    try {
      const issued = await issuePlatformFeeInvoice({
        bookingPaymentId: payment.id,
        insertOnly: true,
      })
      result.recorded[issued.outcome] += 1
      if (issued.invoice || issued.reason === "flag_disabled") continue
      reason = issued.reason ?? issued.outcome
    } catch (err) {
      console.error("[platform-fee-backfill] unexpected error", payment.id, err)
      result.errors += 1
      reason = err instanceof Error ? err.message : String(err)
    }
    try {
      if (await deadLetterPayment(payment, reason)) result.deadLettered += 1
    } catch (err) {
      console.error(
        "[platform-fee-backfill] dead-letter failed",
        payment.id,
        err
      )
      result.errors += 1
    }
  }
  return result
}

// A payment that still has no ledger row would be rescanned every run and
// could fill the batch; park it for operator review instead.
async function deadLetterPayment(
  payment: { id: string; orgId: string },
  reason: string
): Promise<boolean> {
  return withPlatformAudit(
    { orgId: payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [inserted] = await tx
        .insert(main.workflowDeadLetters)
        .values({
          orgId: payment.orgId,
          workflowName: PLATFORM_FEE_BACKFILL_WORKFLOW_NAME,
          entityId: payment.id,
          payload: { bookingPaymentId: payment.id, reason },
          attempts: 1,
          lastError: reason,
        })
        .onConflictDoNothing()
        .returning({ id: main.workflowDeadLetters.id })
      await ctx.emit({
        entity: "booking_payment",
        action: "failed",
        entityId: payment.id,
        payload: {
          workflow: PLATFORM_FEE_BACKFILL_WORKFLOW_NAME,
          reason,
          deadLettered: true,
          created: Boolean(inserted),
        },
      })
      return Boolean(inserted)
    }
  )
}
