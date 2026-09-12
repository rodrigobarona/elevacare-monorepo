import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgContext, withPlatformAdminContext } from "@eleva/db"
import { captureException } from "@eleva/observability"
import { stripe } from "./client"
import { experimentalCreditNoteAllocation } from "./commission"
import {
  cumulativeReversalCents,
  evaluateRefundPolicy,
  nextPayoutStatusAfterRefund,
  nextPayoutStatusAfterTransferReversed,
  type RefundPolicyInput,
} from "./payout-math"
import { applyHold, clearHold } from "./payouts"

export class RefundError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 409) {
    super(message)
    this.name = "RefundError"
    this.code = code
    this.status = status
  }
}

export function isRefundError(err: unknown): err is RefundError {
  return err instanceof RefundError
}

function mapStripeRefundStatus(
  status: string | null | undefined
): "succeeded" | "failed" | "pending" {
  switch (status) {
    case "succeeded":
      return "succeeded"
    case "failed":
    case "canceled":
      return "failed"
    case "pending":
    case "requires_action":
      return "pending"
    default:
      return "pending"
  }
}

function stripeReason(
  reason: string
): "duplicate" | "fraudulent" | "requested_by_customer" | undefined {
  if (reason === "duplicate" || reason === "fraudulent") return reason
  if (reason === "requested_by_customer") return reason
  return undefined
}

export async function refundBookingPayment(input: {
  bookingPaymentId: string
  amountCents?: number
  reason: string
  actorUserId: string | null
  policy?: RefundPolicyInput
  actingOrgId?: string
}): Promise<{ refundId: string; status: "succeeded" | "pending" }> {
  if (!input.reason.trim()) {
    throw new RefundError("REASON_REQUIRED", "Reason is required", 400)
  }
  if (input.policy) {
    const outcome = evaluateRefundPolicy(input.policy)
    if (outcome === "keep") {
      throw new RefundError("POLICY_KEEP", "Policy keeps the payment")
    }
    if (outcome === "requires_review" && input.actorUserId === null) {
      throw new RefundError(
        "POLICY_REVIEW",
        "This refund needs staff review",
        409
      )
    }
  }

  const snapshot = await withPlatformAdminContext(async (tx) => {
    const [payment] = await tx
      .select()
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      .limit(1)
    if (!payment) {
      throw new RefundError(
        "PAYMENT_NOT_FOUND",
        "Booking payment not found",
        404
      )
    }
    if (input.actingOrgId && payment.orgId !== input.actingOrgId) {
      throw new RefundError(
        "ORG_MISMATCH",
        "Payment is not in this organization",
        403
      )
    }
    const remaining = payment.amountCents - payment.refundedCents
    const amountCents = input.amountCents ?? remaining
    if (amountCents <= 0 || amountCents > remaining) {
      throw new RefundError("AMOUNT_INVALID", "Refund amount is invalid", 422)
    }
    const [last] = await tx
      .select({ refundSeq: main.bookingRefunds.refundSeq })
      .from(main.bookingRefunds)
      .where(eq(main.bookingRefunds.bookingPaymentId, payment.id))
      .orderBy(desc(main.bookingRefunds.refundSeq))
      .limit(1)
    const refundSeq = (last?.refundSeq ?? 0) + 1
    const [payout] = await tx
      .select()
      .from(main.payoutStates)
      .where(eq(main.payoutStates.bookingPaymentId, payment.id))
      .limit(1)
    return { payment, amountCents, refundSeq, payout: payout ?? null }
  })

  if (!snapshot.payment.stripePaymentIntentId) {
    throw new RefundError("INTENT_MISSING", "No PaymentIntent on payment")
  }
  const paymentIntentId = snapshot.payment.stripePaymentIntentId

  const refundId = crypto.randomUUID()
  const idempotencyKey = `refund:${input.bookingPaymentId}:${snapshot.refundSeq}`
  const reversalId = snapshot.payout?.stripeTransferId
    ? crypto.randomUUID()
    : null
  const reversalCents = snapshot.payout
    ? cumulativeReversalCents({
        refundedToDate: snapshot.payment.refundedCents + snapshot.amountCents,
        grossCents: snapshot.payment.amountCents,
        transferredCents: snapshot.payout.amountCents,
        reversedToDate: snapshot.payout.reversedCents,
      })
    : 0
  const creditNote = experimentalCreditNoteAllocation(
    {
      bookingGross: snapshot.payment.amountCents,
      platformFeeGross: snapshot.payment.applicationFeeCents,
      platformFeeNet: snapshot.payment.platformFeeNetCents,
      vatOnPlatformFee: snapshot.payment.platformFeeVatCents,
      paymentProcessingFee: snapshot.payment.processingFeeCents,
      expertTransfer:
        snapshot.payout?.amountCents ??
        Math.max(
          0,
          snapshot.payment.amountCents - snapshot.payment.applicationFeeCents
        ),
    },
    snapshot.amountCents,
    snapshot.payment.refundedCents
  )

  await withAudit(
    { orgId: snapshot.payment.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await tx.insert(main.bookingRefunds).values({
        id: refundId,
        orgId: snapshot.payment.orgId,
        bookingPaymentId: input.bookingPaymentId,
        amountCents: snapshot.amountCents,
        status: "pending",
        reason: input.reason,
        refundSeq: snapshot.refundSeq,
        idempotencyKey,
      })
      if (reversalId && snapshot.payout && reversalCents > 0) {
        await tx.insert(main.transferReversals).values({
          id: reversalId,
          orgId: snapshot.payment.orgId,
          payoutStateId: snapshot.payout.id,
          refundId,
          bookingPaymentId: input.bookingPaymentId,
          amountCents: reversalCents,
          status: "pending",
        })
      }
      await ctx.emit({
        entity: "refund",
        action: "requested",
        entityId: refundId,
        payload: {
          bookingPaymentId: input.bookingPaymentId,
          amountCents: snapshot.amountCents,
          refundSeq: snapshot.refundSeq,
        },
      })
    }
  )

  let stripeRefundId: string
  let refundStatus: "succeeded" | "failed" | "pending" = "pending"
  try {
    const refund = await stripe().refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: snapshot.amountCents,
        reason: stripeReason(input.reason),
        metadata: {
          refund_row_id: refundId,
          booking_payment_id: input.bookingPaymentId,
        },
      },
      { idempotencyKey }
    )
    stripeRefundId = refund.id
    refundStatus = mapStripeRefundStatus(refund.status)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await withAudit(
      { orgId: snapshot.payment.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        await tx
          .update(main.bookingRefunds)
          .set({
            status: "failed",
            lastError: message.slice(0, 2000),
            updatedAt: new Date(),
          })
          .where(eq(main.bookingRefunds.id, refundId))
        await ctx.emit({
          entity: "refund",
          action: "failed",
          entityId: refundId,
          payload: { lastError: message.slice(0, 200) },
        })
      }
    )
    throw new RefundError("STRIPE_REFUND_FAILED", message, 502)
  }

  await withAudit(
    { orgId: snapshot.payment.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await tx
        .update(main.bookingRefunds)
        .set({
          status: refundStatus,
          stripeRefundId,
          updatedAt: new Date(),
        })
        .where(eq(main.bookingRefunds.id, refundId))
      if (refundStatus === "succeeded") {
        await tx
          .update(main.bookingPayments)
          .set({
            refundedCents: sql`LEAST(${main.bookingPayments.amountCents}, ${main.bookingPayments.refundedCents} + ${snapshot.amountCents})`,
            applicationFeeCents: sql`GREATEST(0, ${main.bookingPayments.applicationFeeCents} - ${creditNote.platformFeeGross})`,
            platformFeeNetCents: sql`GREATEST(0, ${main.bookingPayments.platformFeeNetCents} - ${creditNote.platformFeeNet})`,
            platformFeeVatCents: sql`GREATEST(0, ${main.bookingPayments.platformFeeVatCents} - ${creditNote.vatOnPlatformFee})`,
            status: sql`CASE WHEN ${main.bookingPayments.refundedCents} + ${snapshot.amountCents} >= ${main.bookingPayments.amountCents} THEN 'refunded' ELSE ${main.bookingPayments.status} END`,
          })
          .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      }
      await ctx.emit({
        entity: "refund",
        action:
          refundStatus === "succeeded"
            ? "succeeded"
            : refundStatus === "failed"
              ? "failed"
              : "requested",
        entityId: refundId,
        payload: { stripeRefundId, amountCents: snapshot.amountCents },
      })
    }
  )

  if (refundStatus === "failed") {
    throw new RefundError("STRIPE_REFUND_FAILED", "Stripe refund failed", 502)
  }
  if (refundStatus === "pending") {
    if (snapshot.payout && reversalCents > 0) {
      await recordPayoutRefundShare({
        payout: snapshot.payout,
        reversalCents: 0,
        actorUserId: input.actorUserId,
        transferExists: Boolean(snapshot.payout.stripeTransferId),
        reversalOk: false,
      })
    }
    return { refundId, status: "pending" }
  }
  if (
    snapshot.payout &&
    reversalCents > 0 &&
    !snapshot.payout.stripeTransferId
  ) {
    await recordPayoutRefundShare({
      payout: snapshot.payout,
      reversalCents,
      actorUserId: input.actorUserId,
      transferExists: false,
      reversalOk: true,
    })
    return { refundId, status: "succeeded" }
  }
  if (!snapshot.payout?.stripeTransferId || reversalCents <= 0) {
    return { refundId, status: "succeeded" }
  }

  await reverseTransferShare({
    payout: snapshot.payout,
    refundId,
    reversalCents,
    actorUserId: input.actorUserId,
  })
  return { refundId, status: "succeeded" }
}

async function recordPayoutRefundShare(input: {
  payout: typeof main.payoutStates.$inferSelect
  reversalCents: number
  actorUserId: string | null
  transferExists: boolean
  reversalOk: boolean
}): Promise<void> {
  const reversedCentsAfter = Math.min(
    input.payout.amountCents,
    input.payout.reversedCents + input.reversalCents
  )
  const nextStatus = nextPayoutStatusAfterRefund({
    previousStatus: input.payout.status,
    amountCents: input.payout.amountCents,
    reversedCentsAfter,
    transferExists: input.transferExists,
    reversalOk: input.reversalOk,
  })
  await withAudit(
    { orgId: input.payout.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await tx
        .update(main.payoutStates)
        .set({
          reversedCents: reversedCentsAfter,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(main.payoutStates.id, input.payout.id))
      await ctx.emit({
        entity: "payout",
        action: nextStatus === "reversed" ? "reversed" : "updated",
        entityId: input.payout.id,
        payload: {
          reversedCents: reversedCentsAfter,
          nextStatus,
          transferExists: input.transferExists,
        },
      })
    }
  )
}

async function reverseTransferShare(input: {
  payout: typeof main.payoutStates.$inferSelect
  refundId: string
  reversalCents: number
  actorUserId: string | null
}): Promise<void> {
  const transferId = input.payout.stripeTransferId
  if (!transferId) return
  const [reversalRow] = await withOrgContext(input.payout.orgId, async (tx) =>
    tx
      .select()
      .from(main.transferReversals)
      .where(eq(main.transferReversals.refundId, input.refundId))
      .limit(1)
  )
  const reversalRowId = reversalRow?.id ?? crypto.randomUUID()
  const idempotencyKey = `reversal:${input.refundId}`

  try {
    const reversal = await stripe().transfers.createReversal(
      transferId,
      {
        amount: input.reversalCents,
        metadata: {
          reversal_row_id: reversalRowId,
          refund_row_id: input.refundId,
        },
      },
      { idempotencyKey }
    )
    await withAudit(
      { orgId: input.payout.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        if (reversalRow) {
          await tx
            .update(main.transferReversals)
            .set({
              status: "succeeded",
              stripeReversalId: reversal.id,
              updatedAt: new Date(),
            })
            .where(eq(main.transferReversals.id, reversalRow.id))
        } else {
          await tx.insert(main.transferReversals).values({
            id: reversalRowId,
            orgId: input.payout.orgId,
            payoutStateId: input.payout.id,
            refundId: input.refundId,
            bookingPaymentId: input.payout.bookingPaymentId,
            amountCents: input.reversalCents,
            status: "succeeded",
            stripeReversalId: reversal.id,
          })
        }
        const [updated] = await tx
          .update(main.payoutStates)
          .set({
            reversedCents: sql`LEAST(${main.payoutStates.amountCents}, ${main.payoutStates.reversedCents} + ${input.reversalCents})`,
            status: sql`CASE WHEN ${main.payoutStates.reversedCents} + ${input.reversalCents} >= ${main.payoutStates.amountCents} THEN 'reversed'::payout_status ELSE ${main.payoutStates.status} END`,
            updatedAt: new Date(),
          })
          .where(eq(main.payoutStates.id, input.payout.id))
          .returning({
            reversedCents: main.payoutStates.reversedCents,
            amountCents: main.payoutStates.amountCents,
            status: main.payoutStates.status,
          })
        const full =
          (updated?.reversedCents ?? 0) >= (updated?.amountCents ?? 0)
        await ctx.emit({
          entity: "payout",
          action: "reversed",
          entityId: input.payout.id,
          payload: {
            stripeReversalId: reversal.id,
            reversalCents: input.reversalCents,
            full,
          },
        })
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await withAudit(
      { orgId: input.payout.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        if (reversalRow) {
          await tx
            .update(main.transferReversals)
            .set({
              status: "failed",
              lastError: message.slice(0, 2000),
              updatedAt: new Date(),
            })
            .where(eq(main.transferReversals.id, reversalRow.id))
        } else {
          await tx.insert(main.transferReversals).values({
            id: reversalRowId,
            orgId: input.payout.orgId,
            payoutStateId: input.payout.id,
            refundId: input.refundId,
            bookingPaymentId: input.payout.bookingPaymentId,
            amountCents: input.reversalCents,
            status: "failed",
            lastError: message.slice(0, 2000),
          })
        }
        await tx
          .update(main.payoutStates)
          .set({
            status: nextPayoutStatusAfterRefund({
              previousStatus: input.payout.status,
              amountCents: input.payout.amountCents,
              reversedCentsAfter: input.payout.reversedCents,
              transferExists: true,
              reversalOk: false,
            }),
            lastError: message.slice(0, 2000),
            updatedAt: new Date(),
          })
          .where(eq(main.payoutStates.id, input.payout.id))
        await ctx.emit({
          entity: "payout",
          action: "failed",
          entityId: input.payout.id,
          payload: {
            code: "REVERSAL_PENDING",
            lastError: message.slice(0, 200),
          },
        })
      }
    )
    void captureException(err, {
      payoutStateId: input.payout.id,
      probe: "transfer-reversal",
    })
  }
}

export async function retryFailedTransferReversals(): Promise<{
  retried: number
}> {
  const rows = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        refundId: main.transferReversals.refundId,
        reversalCents: main.transferReversals.amountCents,
        payout: main.payoutStates,
      })
      .from(main.transferReversals)
      .innerJoin(
        main.payoutStates,
        eq(main.transferReversals.payoutStateId, main.payoutStates.id)
      )
      .where(
        and(
          eq(main.transferReversals.status, "failed"),
          eq(main.payoutStates.status, "reversal_pending"),
          isNotNull(main.payoutStates.stripeTransferId)
        )
      )
  )
  for (const row of rows) {
    await reverseTransferShare({
      payout: row.payout,
      refundId: row.refundId,
      reversalCents: row.reversalCents,
      actorUserId: null,
    })
  }
  return { retried: rows.length }
}

export async function applyDisputeOpened(input: {
  bookingPaymentId: string
}): Promise<void> {
  const [payment] = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        id: main.bookingPayments.id,
        orgId: main.bookingPayments.orgId,
      })
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      .limit(1)
  )
  if (!payment) return
  const payout = await withAudit(
    { orgId: payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.bookingPayments)
        .set({ disputeStatus: "open" })
        .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      const [row] = await tx
        .select()
        .from(main.payoutStates)
        .where(eq(main.payoutStates.bookingPaymentId, input.bookingPaymentId))
        .limit(1)
      await ctx.emit({
        entity: "dispute",
        action: "opened",
        entityId: input.bookingPaymentId,
        payload: { disputeStatus: "open" },
      })
      return row ?? null
    }
  )
  if (payout) {
    await applyHold({
      payoutStateId: payout.id,
      reason: "dispute",
      actorUserId: null,
    })
  }
}

export async function applyDisputeClosed(input: {
  bookingPaymentId: string
  won: boolean
}): Promise<void> {
  const [payment] = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        id: main.bookingPayments.id,
        orgId: main.bookingPayments.orgId,
      })
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      .limit(1)
  )
  if (!payment) return
  const payout = await withAudit(
    { orgId: payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.bookingPayments)
        .set(
          input.won
            ? { disputeStatus: "won" }
            : {
                disputeStatus: "lost",
                refundedCents: sql`${main.bookingPayments.amountCents}`,
                status: "refunded",
              }
        )
        .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      const [row] = await tx
        .select()
        .from(main.payoutStates)
        .where(eq(main.payoutStates.bookingPaymentId, input.bookingPaymentId))
        .limit(1)
      await ctx.emit({
        entity: "dispute",
        action: "closed",
        entityId: input.bookingPaymentId,
        payload: { outcome: input.won ? "won" : "lost" },
      })
      return row ?? null
    }
  )
  if (!payout) return
  if (input.won) {
    await clearHold({
      payoutStateId: payout.id,
      reason: "dispute",
      actorUserId: null,
    })
    return
  }
  const remaining = payout.amountCents - payout.reversedCents
  if (payout.stripeTransferId && remaining > 0) {
    const refundId = crypto.randomUUID()
    const created = await withAudit(
      { orgId: payout.orgId, actorUserId: null },
      async (tx, ctx) => {
        const [inserted] = await tx
          .insert(main.bookingRefunds)
          .values({
            id: refundId,
            orgId: payout.orgId,
            bookingPaymentId: input.bookingPaymentId,
            amountCents: remaining,
            status: "succeeded",
            reason: "dispute_lost",
            refundSeq: 0,
            idempotencyKey: `dispute-loss:${input.bookingPaymentId}`,
          })
          .onConflictDoNothing({
            target: main.bookingRefunds.idempotencyKey,
          })
          .returning({ id: main.bookingRefunds.id })
        await ctx.emit({
          entity: "dispute",
          action: "updated",
          entityId: input.bookingPaymentId,
          payload: { outcome: "lost", idempotentReplay: !inserted },
        })
        return inserted?.id ?? null
      }
    )
    if (!created) return
    await reverseTransferShare({
      payout,
      refundId: created,
      reversalCents: remaining,
      actorUserId: null,
    })
    return
  }

  await withAudit(
    { orgId: payout.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.payoutStates)
        .set({
          status: "reversed",
          reversedCents: payout.amountCents,
          holdReasons: [],
          heldFromStatus: null,
          lastError: "dispute_lost",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(main.payoutStates.id, payout.id),
            eq(main.payoutStates.orgId, payout.orgId)
          )
        )
      await ctx.emit({
        entity: "dispute",
        action: "updated",
        entityId: input.bookingPaymentId,
        payload: {
          outcome: "lost",
          payoutStatus: "reversed",
          transferred: Boolean(payout.stripeTransferId),
        },
      })
    }
  )
}

export async function confirmRefundFromCharge(input: {
  paymentIntentId: string
  amountRefunded: number
  stripeRefundId: string | null
  refundRowId?: string | null
}): Promise<string | null> {
  const [payment] = await withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.bookingPayments)
      .where(
        eq(main.bookingPayments.stripePaymentIntentId, input.paymentIntentId)
      )
      .limit(1)
  )
  if (!payment) return null
  await withAudit(
    { orgId: payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [fresh] = await tx
        .select({
          refundedCents: main.bookingPayments.refundedCents,
          amountCents: main.bookingPayments.amountCents,
          status: main.bookingPayments.status,
        })
        .from(main.bookingPayments)
        .where(eq(main.bookingPayments.id, payment.id))
        .limit(1)
      if (fresh && fresh.refundedCents < input.amountRefunded) {
        await tx
          .update(main.bookingPayments)
          .set({
            refundedCents: sql`GREATEST(${main.bookingPayments.refundedCents}, ${input.amountRefunded})`,
            status:
              input.amountRefunded >= fresh.amountCents
                ? "refunded"
                : fresh.status,
          })
          .where(eq(main.bookingPayments.id, payment.id))
      }
      const refundMatch = input.refundRowId
        ? eq(main.bookingRefunds.id, input.refundRowId)
        : input.stripeRefundId
          ? eq(main.bookingRefunds.stripeRefundId, input.stripeRefundId)
          : undefined
      if (refundMatch) {
        await tx
          .update(main.bookingRefunds)
          .set({
            status: "succeeded",
            stripeRefundId: input.stripeRefundId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(main.bookingRefunds.bookingPaymentId, payment.id),
              refundMatch
            )
          )
      }
      await ctx.emit({
        entity: "refund",
        action: "succeeded",
        entityId: input.refundRowId ?? payment.id,
        payload: { amountRefunded: input.amountRefunded },
      })
    }
  )
  await completeTransferReversalForPayment(payment.id)
  return payment.id
}

async function completeTransferReversalForPayment(
  bookingPaymentId: string
): Promise<void> {
  const snapshot = await withPlatformAdminContext(async (tx) => {
    const [payment] = await tx
      .select()
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, bookingPaymentId))
      .limit(1)
    const [payout] = await tx
      .select()
      .from(main.payoutStates)
      .where(eq(main.payoutStates.bookingPaymentId, bookingPaymentId))
      .limit(1)
    const [refund] = await tx
      .select({ id: main.bookingRefunds.id })
      .from(main.bookingRefunds)
      .where(
        and(
          eq(main.bookingRefunds.bookingPaymentId, bookingPaymentId),
          eq(main.bookingRefunds.status, "succeeded")
        )
      )
      .orderBy(desc(main.bookingRefunds.refundSeq))
      .limit(1)
    return {
      payment: payment ?? null,
      payout: payout ?? null,
      refundId: refund?.id ?? null,
    }
  })
  if (!snapshot.payment || !snapshot.payout) return
  const reversalCents = cumulativeReversalCents({
    refundedToDate: snapshot.payment.refundedCents,
    grossCents: snapshot.payment.amountCents,
    transferredCents: snapshot.payout.amountCents,
    reversedToDate: snapshot.payout.reversedCents,
  })
  if (reversalCents <= 0) return
  if (!snapshot.payout.stripeTransferId) {
    await recordPayoutRefundShare({
      payout: snapshot.payout,
      reversalCents,
      actorUserId: null,
      transferExists: false,
      reversalOk: true,
    })
    return
  }
  await reverseTransferShare({
    payout: snapshot.payout,
    refundId: snapshot.refundId ?? crypto.randomUUID(),
    reversalCents,
    actorUserId: null,
  })
}

export async function confirmTransferReversed(input: {
  stripeTransferId: string
  reversedCents: number
}): Promise<string | null> {
  const [payout] = await withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.payoutStates)
      .where(eq(main.payoutStates.stripeTransferId, input.stripeTransferId))
      .limit(1)
  )
  if (!payout) return null
  const next = Math.min(
    payout.amountCents,
    Math.max(payout.reversedCents, input.reversedCents)
  )
  const full = next >= payout.amountCents
  await withAudit(
    { orgId: payout.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.payoutStates)
        .set({
          reversedCents: next,
          status: nextPayoutStatusAfterTransferReversed({
            full,
            status: payout.status,
            holdReasons: payout.holdReasons ?? [],
            heldFromStatus: payout.heldFromStatus,
          }),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(main.payoutStates.id, payout.id))
      const [openReversal] = await tx
        .select({ id: main.transferReversals.id })
        .from(main.transferReversals)
        .where(
          and(
            eq(main.transferReversals.payoutStateId, payout.id),
            inArray(main.transferReversals.status, ["pending", "failed"])
          )
        )
        .orderBy(desc(main.transferReversals.createdAt))
        .limit(1)
      if (openReversal) {
        await tx
          .update(main.transferReversals)
          .set({ status: "succeeded", updatedAt: new Date() })
          .where(eq(main.transferReversals.id, openReversal.id))
      }
      await ctx.emit({
        entity: "payout",
        action: "reversed",
        entityId: payout.id,
        payload: { reversedCents: next, full },
      })
    }
  )
  return payout.id
}

export async function markRefundFailedFromStripe(input: {
  paymentIntentId: string
  stripeRefundId: string
  refundRowId?: string | null
}): Promise<void> {
  const [payment] = await withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.bookingPayments)
      .where(
        eq(main.bookingPayments.stripePaymentIntentId, input.paymentIntentId)
      )
      .limit(1)
  )
  if (!payment) return
  const existing = await withPlatformAdminContext(async (tx) => {
    const match = input.refundRowId
      ? eq(main.bookingRefunds.id, input.refundRowId)
      : eq(main.bookingRefunds.stripeRefundId, input.stripeRefundId)
    const [row] = await tx
      .select()
      .from(main.bookingRefunds)
      .where(and(eq(main.bookingRefunds.bookingPaymentId, payment.id), match))
      .limit(1)
    return row ?? null
  })
  if (!existing || existing.status === "failed") return
  await withAudit(
    { orgId: payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      const row = existing
      if (row.status === "succeeded") {
        await tx
          .update(main.bookingPayments)
          .set({
            refundedCents: sql`GREATEST(0, ${main.bookingPayments.refundedCents} - ${row.amountCents})`,
            status: sql`CASE
            WHEN GREATEST(0, ${main.bookingPayments.refundedCents} - ${row.amountCents}) >= ${main.bookingPayments.amountCents} THEN 'refunded'
            WHEN ${main.bookingPayments.status} = 'refunded' THEN 'succeeded'
            ELSE ${main.bookingPayments.status}
          END`,
          })
          .where(eq(main.bookingPayments.id, payment.id))
      }
      await tx
        .update(main.bookingRefunds)
        .set({
          status: "failed",
          stripeRefundId: input.stripeRefundId,
          lastError: "stripe_refund_failed",
          updatedAt: new Date(),
        })
        .where(eq(main.bookingRefunds.id, row.id))
      await ctx.emit({
        entity: "refund",
        action: "failed",
        entityId: row.id,
        payload: { stripeRefundId: input.stripeRefundId },
      })
    }
  )
}

export async function findBookingPaymentIdByCharge(input: {
  paymentIntentId: string | null
  chargeId: string | null
}): Promise<string | null> {
  return withPlatformAdminContext(async (tx) => {
    if (input.paymentIntentId) {
      const [byPi] = await tx
        .select({ id: main.bookingPayments.id })
        .from(main.bookingPayments)
        .where(
          eq(main.bookingPayments.stripePaymentIntentId, input.paymentIntentId)
        )
        .limit(1)
      if (byPi) return byPi.id
    }
    if (input.chargeId) {
      const [byCharge] = await tx
        .select({ id: main.bookingPayments.id })
        .from(main.bookingPayments)
        .where(eq(main.bookingPayments.stripeChargeId, input.chargeId))
        .limit(1)
      return byCharge?.id ?? null
    }
    return null
  })
}
