import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgContext, withPlatformAdminContext } from "@eleva/db"
import { captureException } from "@eleva/observability"
import { stripe } from "./client"
import { creditNoteAllocation } from "./commission"
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
  actingOrgId: string | "platform"
  idempotencyKey?: string
  actorIsStaffReviewer?: boolean
}): Promise<{ refundId: string; status: "succeeded" | "pending" }> {
  if (!input.reason.trim()) {
    throw new RefundError("REASON_REQUIRED", "Reason is required", 400)
  }
  if (input.policy) {
    const outcome = evaluateRefundPolicy(input.policy)
    if (outcome === "keep") {
      throw new RefundError("POLICY_KEEP", "Policy keeps the payment")
    }
    if (outcome === "requires_review" && !input.actorIsStaffReviewer) {
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
    if (
      input.actingOrgId !== "platform" &&
      payment.orgId !== input.actingOrgId
    ) {
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

  const idempotencyKey = input.idempotencyKey?.trim()
    ? `refund:${snapshot.payment.id}:${input.idempotencyKey.trim()}`
    : `refund:${snapshot.payment.id}:${snapshot.amountCents}:${snapshot.refundSeq}`
  const [existingRefund] = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        id: main.bookingRefunds.id,
        status: main.bookingRefunds.status,
      })
      .from(main.bookingRefunds)
      .where(
        and(
          eq(main.bookingRefunds.idempotencyKey, idempotencyKey),
          eq(main.bookingRefunds.bookingPaymentId, snapshot.payment.id)
        )
      )
      .limit(1)
  )
  if (existingRefund?.status === "succeeded") {
    return { refundId: existingRefund.id, status: "succeeded" }
  }
  let refundId = existingRefund?.id ?? crypto.randomUUID()
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
  const creditNote = creditNoteAllocation(
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

  if (!existingRefund) {
    await withAudit(
      { orgId: snapshot.payment.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        const [inserted] = await tx
          .insert(main.bookingRefunds)
          .values({
            id: refundId,
            orgId: snapshot.payment.orgId,
            bookingPaymentId: input.bookingPaymentId,
            amountCents: snapshot.amountCents,
            status: "pending",
            reason: input.reason,
            refundSeq: snapshot.refundSeq,
            idempotencyKey,
          })
          .onConflictDoNothing({
            target: main.bookingRefunds.idempotencyKey,
          })
          .returning({ id: main.bookingRefunds.id })
        if (!inserted) {
          const [existing] = await tx
            .select({ id: main.bookingRefunds.id })
            .from(main.bookingRefunds)
            .where(eq(main.bookingRefunds.idempotencyKey, idempotencyKey))
            .limit(1)
          refundId = existing?.id ?? refundId
          await ctx.emit({
            entity: "refund",
            action: "requested",
            entityId: refundId,
            payload: {
              bookingPaymentId: input.bookingPaymentId,
              amountCents: snapshot.amountCents,
              refundSeq: snapshot.refundSeq,
              idempotentReplay: true,
            },
          })
          return
        }
        refundId = inserted.id
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
  }

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

async function findExistingStripeReversal(input: {
  transferId: string
  reversalRowId: string
  refundId: string
}): Promise<{ id: string } | null> {
  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe().transfers.listReversals(input.transferId, {
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const match = page.data.find((row) => {
      const meta = row.metadata ?? {}
      return (
        meta.reversal_row_id === input.reversalRowId ||
        meta.refund_row_id === input.refundId
      )
    })
    if (match) return { id: match.id }
    if (!page.has_more || page.data.length === 0) return null
    const lastId = page.data[page.data.length - 1]?.id
    if (!lastId) return null
    startingAfter = lastId
  }
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
  if (reversalRow?.status === "succeeded") return
  const reversalRowId = reversalRow?.id ?? crypto.randomUUID()
  const reversalAmount = reversalRow?.amountCents ?? input.reversalCents
  const idempotencyKey = `reversal:${reversalRowId}`

  let stripeReversalId = reversalRow?.stripeReversalId ?? null
  try {
    if (!stripeReversalId) {
      const existing = await findExistingStripeReversal({
        transferId,
        reversalRowId,
        refundId: input.refundId,
      })
      stripeReversalId = existing?.id ?? null
    }
    if (!stripeReversalId) {
      const reversal = await stripe().transfers.createReversal(
        transferId,
        {
          amount: reversalAmount,
          metadata: {
            reversal_row_id: reversalRowId,
            refund_row_id: input.refundId,
          },
        },
        { idempotencyKey }
      )
      stripeReversalId = reversal.id
    }
    const reversal = { id: stripeReversalId }
    await withAudit(
      { orgId: input.payout.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        let claimed = false
        if (reversalRow) {
          const [row] = await tx
            .update(main.transferReversals)
            .set({
              status: "succeeded",
              stripeReversalId: reversal.id,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(main.transferReversals.id, reversalRow.id),
                inArray(main.transferReversals.status, ["pending", "failed"])
              )
            )
            .returning({ id: main.transferReversals.id })
          claimed = Boolean(row)
        } else {
          const inserted = await tx
            .insert(main.transferReversals)
            .values({
              id: reversalRowId,
              orgId: input.payout.orgId,
              payoutStateId: input.payout.id,
              refundId: input.refundId,
              bookingPaymentId: input.payout.bookingPaymentId,
              amountCents: input.reversalCents,
              status: "succeeded",
              stripeReversalId: reversal.id,
            })
            .onConflictDoNothing({
              target: main.transferReversals.refundId,
            })
            .returning({ id: main.transferReversals.id })
          claimed = inserted.length > 0
        }
        if (!claimed) {
          await ctx.emit({
            entity: "payout",
            action: "reversed",
            entityId: input.payout.id,
            payload: {
              stripeReversalId: reversal.id,
              reversalCents: reversalAmount,
              duplicate: true,
            },
          })
          return
        }
        const [updated] = await tx
          .update(main.payoutStates)
          .set({
            reversedCents: sql`LEAST(${main.payoutStates.amountCents}, ${main.payoutStates.reversedCents} + ${reversalAmount})`,
            status: sql`CASE WHEN ${main.payoutStates.reversedCents} + ${reversalAmount} >= ${main.payoutStates.amountCents} THEN 'reversed'::payout_status ELSE ${main.payoutStates.status} END`,
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
            reversalCents: reversalAmount,
            full,
          },
        })
      }
    )
  } catch (err) {
    if (stripeReversalId) {
      void captureException(err, {
        payoutStateId: input.payout.id,
        probe: "transfer-reversal-persist",
        stripeReversalId,
      })
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    await withAudit(
      { orgId: input.payout.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        let claimed = false
        if (reversalRow) {
          const [row] = await tx
            .update(main.transferReversals)
            .set({
              status: "failed",
              lastError: message.slice(0, 2000),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(main.transferReversals.id, reversalRow.id),
                inArray(main.transferReversals.status, ["pending", "failed"])
              )
            )
            .returning({ id: main.transferReversals.id })
          claimed = Boolean(row)
        } else {
          const inserted = await tx
            .insert(main.transferReversals)
            .values({
              id: reversalRowId,
              orgId: input.payout.orgId,
              payoutStateId: input.payout.id,
              refundId: input.refundId,
              bookingPaymentId: input.payout.bookingPaymentId,
              amountCents: input.reversalCents,
              status: "failed",
              lastError: message.slice(0, 2000),
            })
            .onConflictDoNothing({
              target: main.transferReversals.refundId,
            })
            .returning({ id: main.transferReversals.id })
          claimed = inserted.length > 0
        }
        if (claimed) {
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
        }
        await ctx.emit({
          entity: "payout",
          action: "failed",
          entityId: input.payout.id,
          payload: {
            code: "REVERSAL_PENDING",
            lastError: message.slice(0, 200),
            duplicate: !claimed,
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
      .innerJoin(
        main.bookingRefunds,
        eq(main.transferReversals.refundId, main.bookingRefunds.id)
      )
      .where(
        and(
          inArray(main.transferReversals.status, ["pending", "failed"]),
          eq(main.bookingRefunds.status, "succeeded"),
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
  const closed = await withAudit(
    { orgId: payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [fresh] = await tx
        .select({
          amountCents: main.bookingPayments.amountCents,
          refundedCents: main.bookingPayments.refundedCents,
        })
        .from(main.bookingPayments)
        .where(eq(main.bookingPayments.id, input.bookingPaymentId))
        .limit(1)
      const chargeRefundCents = Math.max(
        0,
        (fresh?.amountCents ?? 0) - (fresh?.refundedCents ?? 0)
      )
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
      let refundId: string | null = null
      if (!input.won && row) {
        const [inserted] = await tx
          .insert(main.bookingRefunds)
          .values({
            id: crypto.randomUUID(),
            orgId: payment.orgId,
            bookingPaymentId: input.bookingPaymentId,
            amountCents: chargeRefundCents,
            status: "succeeded",
            reason: "dispute_lost",
            refundSeq: 0,
            idempotencyKey: `dispute-loss:${input.bookingPaymentId}`,
          })
          .onConflictDoNothing({
            target: main.bookingRefunds.idempotencyKey,
          })
          .returning({ id: main.bookingRefunds.id })
        if (inserted) {
          refundId = inserted.id
        } else {
          const [existing] = await tx
            .select({ id: main.bookingRefunds.id })
            .from(main.bookingRefunds)
            .where(
              eq(
                main.bookingRefunds.idempotencyKey,
                `dispute-loss:${input.bookingPaymentId}`
              )
            )
            .limit(1)
          refundId = existing?.id ?? null
        }
      }
      await ctx.emit({
        entity: "dispute",
        action: "closed",
        entityId: input.bookingPaymentId,
        payload: {
          outcome: input.won ? "won" : "lost",
          chargeRefundCents,
        },
      })
      return { payout: row ?? null, refundId }
    }
  )
  if (!closed.payout) return
  const payoutRow = closed.payout
  if (input.won) {
    await clearHold({
      payoutStateId: payoutRow.id,
      reason: "dispute",
      actorUserId: null,
    })
    return
  }
  const remaining = payoutRow.amountCents - payoutRow.reversedCents
  if (payoutRow.stripeTransferId && remaining > 0) {
    if (!closed.refundId) return
    await reverseTransferShare({
      payout: payoutRow,
      refundId: closed.refundId,
      reversalCents: remaining,
      actorUserId: null,
    })
    return
  }

  await withAudit(
    { orgId: payoutRow.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.payoutStates)
        .set({
          status: "reversed",
          reversedCents: payoutRow.amountCents,
          holdReasons: [],
          heldFromStatus: null,
          lastError: "dispute_lost",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(main.payoutStates.id, payoutRow.id),
            eq(main.payoutStates.orgId, payoutRow.orgId)
          )
        )
      await ctx.emit({
        entity: "dispute",
        action: "updated",
        entityId: input.bookingPaymentId,
        payload: {
          outcome: "lost",
          payoutStatus: "reversed",
          transferred: Boolean(payoutRow.stripeTransferId),
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
  const refundRowId = await withAudit(
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
      let matchedRefundId: string | null = null
      if (refundMatch) {
        const [updated] = await tx
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
          .returning({ id: main.bookingRefunds.id })
        matchedRefundId = updated?.id ?? null
      }
      if (!matchedRefundId && input.stripeRefundId) {
        const [existing] = await tx
          .select({ id: main.bookingRefunds.id })
          .from(main.bookingRefunds)
          .where(eq(main.bookingRefunds.stripeRefundId, input.stripeRefundId))
          .limit(1)
        matchedRefundId = existing?.id ?? null
      }
      if (!matchedRefundId) {
        const priorRefunded = fresh?.refundedCents ?? payment.refundedCents
        const delta = input.amountRefunded - priorRefunded
        if (delta > 0) {
          const [last] = await tx
            .select({ refundSeq: main.bookingRefunds.refundSeq })
            .from(main.bookingRefunds)
            .where(eq(main.bookingRefunds.bookingPaymentId, payment.id))
            .orderBy(desc(main.bookingRefunds.refundSeq))
            .limit(1)
          const [inserted] = await tx
            .insert(main.bookingRefunds)
            .values({
              orgId: payment.orgId,
              bookingPaymentId: payment.id,
              amountCents: delta,
              status: "succeeded",
              stripeRefundId: input.stripeRefundId,
              reason: "charge_refunded",
              refundSeq: (last?.refundSeq ?? 0) + 1,
              idempotencyKey: `charge-refunded:${payment.id}:${input.stripeRefundId ?? `seq-${(last?.refundSeq ?? 0) + 1}`}`,
            })
            .onConflictDoNothing({
              target: main.bookingRefunds.idempotencyKey,
            })
            .returning({ id: main.bookingRefunds.id })
          matchedRefundId = inserted?.id ?? null
        }
      }
      await ctx.emit({
        entity: "refund",
        action: "succeeded",
        entityId: matchedRefundId ?? input.refundRowId ?? payment.id,
        payload: { amountRefunded: input.amountRefunded },
      })
      return matchedRefundId
    }
  )
  await completeTransferReversalForPayment(
    payment.id,
    refundRowId ?? input.refundRowId
  ).catch((err) => {
    void captureException(err, {
      bookingPaymentId: payment.id,
      probe: "confirm-refund-reversal-reconcile",
    })
  })
  return payment.id
}

export async function completeTransferReversalForPayment(
  bookingPaymentId: string,
  refundRowId?: string | null
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
    const refundFilter = [
      eq(main.bookingRefunds.bookingPaymentId, bookingPaymentId),
      eq(main.bookingRefunds.status, "succeeded"),
    ]
    if (refundRowId) {
      refundFilter.push(eq(main.bookingRefunds.id, refundRowId))
    }
    const [refund] = await tx
      .select({ id: main.bookingRefunds.id })
      .from(main.bookingRefunds)
      .where(and(...refundFilter))
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
  const refundId =
    snapshot.refundId ??
    (await persistSucceededRefundForReversal({
      bookingPaymentId,
      payment: snapshot.payment,
      payout: snapshot.payout,
      reversalCents,
    }))
  if (!refundId) {
    void captureException(
      new Error("no succeeded refund row for transfer reversal"),
      { bookingPaymentId, probe: "complete-transfer-reversal" }
    )
    return
  }
  await reverseTransferShare({
    payout: snapshot.payout,
    refundId,
    reversalCents,
    actorUserId: null,
  })
}

async function persistSucceededRefundForReversal(input: {
  bookingPaymentId: string
  payment: typeof main.bookingPayments.$inferSelect
  payout: typeof main.payoutStates.$inferSelect
  reversalCents: number
}): Promise<string | null> {
  return withAudit(
    { orgId: input.payment.orgId, actorUserId: null },
    async (tx, ctx) => {
      const customerRefundCents = input.payment.refundedCents
      if (customerRefundCents <= 0) {
        await ctx.emit({
          entity: "refund",
          action: "succeeded",
          entityId: input.bookingPaymentId,
          payload: {
            reconciled: true,
            skipped: "refunded_cents_missing",
            reversalCents: input.reversalCents,
          },
        })
        return null
      }
      const [last] = await tx
        .select({ refundSeq: main.bookingRefunds.refundSeq })
        .from(main.bookingRefunds)
        .where(eq(main.bookingRefunds.bookingPaymentId, input.bookingPaymentId))
        .orderBy(desc(main.bookingRefunds.refundSeq))
        .limit(1)
      const idempotencyKey = `charge-refunded:${input.bookingPaymentId}`
      const [inserted] = await tx
        .insert(main.bookingRefunds)
        .values({
          orgId: input.payment.orgId,
          bookingPaymentId: input.bookingPaymentId,
          amountCents: customerRefundCents,
          status: "succeeded",
          reason: "charge_refunded",
          refundSeq: (last?.refundSeq ?? 0) + 1,
          idempotencyKey,
        })
        .onConflictDoNothing({
          target: main.bookingRefunds.idempotencyKey,
        })
        .returning({ id: main.bookingRefunds.id })
      const refund = inserted
        ? inserted
        : (
            await tx
              .select({ id: main.bookingRefunds.id })
              .from(main.bookingRefunds)
              .where(eq(main.bookingRefunds.idempotencyKey, idempotencyKey))
              .limit(1)
          )[0]
      if (refund?.id && input.payout.stripeTransferId) {
        await tx
          .insert(main.transferReversals)
          .values({
            orgId: input.payment.orgId,
            payoutStateId: input.payout.id,
            refundId: refund.id,
            bookingPaymentId: input.bookingPaymentId,
            amountCents: input.reversalCents,
            status: "pending",
          })
          .onConflictDoNothing({
            target: main.transferReversals.refundId,
          })
      }
      await ctx.emit({
        entity: "refund",
        action: "succeeded",
        entityId: refund?.id ?? input.bookingPaymentId,
        payload: {
          reconciled: true,
          reversalCents: input.reversalCents,
        },
      })
      return refund?.id ?? null
    }
  )
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
  const match = input.refundRowId
    ? eq(main.bookingRefunds.id, input.refundRowId)
    : eq(main.bookingRefunds.stripeRefundId, input.stripeRefundId)
  const refundScope = and(
    eq(main.bookingRefunds.bookingPaymentId, payment.id),
    match
  )
  try {
    await withAudit(
      { orgId: payment.orgId, actorUserId: null },
      async (tx, ctx) => {
        const failedPatch = {
          status: "failed" as const,
          stripeRefundId: input.stripeRefundId,
          lastError: "stripe_refund_failed",
          updatedAt: new Date(),
        }
        const [fromSucceeded] = await tx
          .update(main.bookingRefunds)
          .set(failedPatch)
          .where(and(refundScope, eq(main.bookingRefunds.status, "succeeded")))
          .returning({
            id: main.bookingRefunds.id,
            amountCents: main.bookingRefunds.amountCents,
          })
        if (fromSucceeded) {
          await tx
            .update(main.bookingPayments)
            .set({
              refundedCents: sql`GREATEST(0, ${main.bookingPayments.refundedCents} - ${fromSucceeded.amountCents})`,
              status: sql`CASE
            WHEN GREATEST(0, ${main.bookingPayments.refundedCents} - ${fromSucceeded.amountCents}) >= ${main.bookingPayments.amountCents} THEN 'refunded'
            WHEN ${main.bookingPayments.status} = 'refunded' THEN 'succeeded'
            ELSE ${main.bookingPayments.status}
          END`,
            })
            .where(eq(main.bookingPayments.id, payment.id))
          await ctx.emit({
            entity: "refund",
            action: "failed",
            entityId: fromSucceeded.id,
            payload: { stripeRefundId: input.stripeRefundId },
          })
          return
        }
        const [fromPending] = await tx
          .update(main.bookingRefunds)
          .set(failedPatch)
          .where(and(refundScope, eq(main.bookingRefunds.status, "pending")))
          .returning({ id: main.bookingRefunds.id })
        if (!fromPending) {
          throw new RefundError(
            "ALREADY_FAILED",
            "Refund is already marked failed"
          )
        }
        await ctx.emit({
          entity: "refund",
          action: "failed",
          entityId: fromPending.id,
          payload: { stripeRefundId: input.stripeRefundId },
        })
      }
    )
  } catch (err) {
    if (isRefundError(err) && err.code === "ALREADY_FAILED") return
    throw err
  }
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
