import { and, eq, inArray, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { captureException } from "@eleva/observability"
import { stripe } from "./client"
import {
  applyHoldSet,
  clearHoldSet,
  computeEligibleAt,
  needsPayoutApproval,
  payoutApprovalThresholdCents,
  type HoldReason,
  type PayoutStatus,
} from "./payout-math"

const TRANSFER_MAX_ATTEMPTS = 8

export class PayoutError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 409) {
    super(message)
    this.name = "PayoutError"
    this.code = code
    this.status = status
  }
}

export function isPayoutError(err: unknown): err is PayoutError {
  return err instanceof PayoutError
}

type PayoutRow = typeof main.payoutStates.$inferSelect

async function loadPayout(tx: Tx, payoutStateId: string): Promise<PayoutRow> {
  const [row] = await tx
    .select()
    .from(main.payoutStates)
    .where(eq(main.payoutStates.id, payoutStateId))
    .limit(1)
  if (!row) {
    throw new PayoutError("PAYOUT_NOT_FOUND", "Payout not found", 404)
  }
  return row
}

export async function createPayoutStateForPaidPayment(input: {
  bookingPaymentId: string
  orgId: string
}): Promise<{ created: boolean; payoutStateId: string | null }> {
  const snapshot = await withOrgContext(input.orgId, async (tx) => {
    const [payment] = await tx
      .select()
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      .limit(1)
    if (!payment) return null
    const [booking] = await tx
      .select({
        endsAt: main.bookings.endsAt,
        id: main.bookings.id,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, payment.bookingId))
      .limit(1)
    const [customer] = await tx
      .select({
        stripeConnectAccountId: main.billingCustomers.stripeConnectAccountId,
      })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, input.orgId))
      .limit(1)
    const existing = await tx
      .select({ id: main.payoutStates.id })
      .from(main.payoutStates)
      .where(eq(main.payoutStates.bookingPaymentId, payment.id))
      .limit(1)
    const priorForAccount = customer?.stripeConnectAccountId
      ? await tx
          .select({ id: main.payoutStates.id })
          .from(main.payoutStates)
          .where(
            eq(
              main.payoutStates.destinationConnectAccountId,
              customer.stripeConnectAccountId
            )
          )
          .limit(1)
      : []
    return {
      payment,
      booking,
      connectAccountId: customer?.stripeConnectAccountId ?? null,
      existingId: existing[0]?.id ?? null,
      isFirstPayout: priorForAccount.length === 0,
    }
  })

  if (!snapshot) {
    throw new PayoutError("PAYMENT_NOT_FOUND", "Booking payment not found", 404)
  }
  if (snapshot.existingId) {
    return { created: false, payoutStateId: snapshot.existingId }
  }
  if (!snapshot.connectAccountId) {
    return { created: false, payoutStateId: null }
  }
  if (!snapshot.booking || !snapshot.payment.paidAt) {
    return { created: false, payoutStateId: null }
  }

  const eligibleAt = computeEligibleAt(
    snapshot.payment.paidAt,
    snapshot.booking.endsAt
  )
  const amountCents = Math.max(
    0,
    snapshot.payment.amountCents - snapshot.payment.applicationFeeCents
  )
  const thresholdCents = payoutApprovalThresholdCents(
    process.env.PAYOUT_APPROVAL_THRESHOLD_CENTS
  )
  const approval = needsPayoutApproval({
    amountCents,
    isFirstPayoutForAccount: snapshot.isFirstPayout,
    thresholdCents,
  })
  const status: PayoutStatus = approval ? "approval_required" : "pending"
  const id = crypto.randomUUID()

  await withAudit(
    { orgId: input.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx.insert(main.payoutStates).values({
        id,
        orgId: input.orgId,
        bookingPaymentId: input.bookingPaymentId,
        expertOrgId: input.orgId,
        destinationOrgId: input.orgId,
        destinationConnectAccountId: snapshot.connectAccountId!,
        status,
        amountCents,
        eligibleAt,
        scheduledFor: approval ? null : eligibleAt,
      })
      await ctx.emit({
        entity: "payout",
        action: approval ? "requested" : "scheduled",
        entityId: id,
        payload: {
          bookingPaymentId: input.bookingPaymentId,
          status,
          amountCents,
          eligibleAt: eligibleAt.toISOString(),
          thresholdCents,
          firstPayout: snapshot.isFirstPayout,
        },
      })
    }
  )

  return { created: true, payoutStateId: id }
}

export async function applyHold(input: {
  payoutStateId: string
  reason: HoldReason
  actorUserId: string | null
  staffReason?: string
}): Promise<PayoutRow> {
  const probe = await withPlatformAdminContext(async (tx) =>
    loadPayout(tx, input.payoutStateId)
  )
  if (probe.status === "reversed") {
    throw new PayoutError("PAYOUT_TERMINAL", "Cannot hold a reversed payout")
  }
  return withAudit(
    { orgId: probe.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const current = await loadPayout(tx, input.payoutStateId)
      if (current.status === "reversed") {
        throw new PayoutError(
          "PAYOUT_TERMINAL",
          "Cannot hold a reversed payout"
        )
      }
      const next = applyHoldSet({
        holdReasons: current.holdReasons ?? [],
        status: current.status,
        heldFromStatus: current.heldFromStatus,
        reason: input.reason,
      })
      const [row] = await tx
        .update(main.payoutStates)
        .set({
          status: "held",
          holdReasons: next.holdReasons,
          heldFromStatus: next.heldFromStatus,
          updatedAt: new Date(),
        })
        .where(eq(main.payoutStates.id, input.payoutStateId))
        .returning()
      await ctx.emit({
        entity: "payout",
        action: "held",
        entityId: input.payoutStateId,
        payload: {
          reason: input.reason,
          staffReason: input.staffReason ?? null,
          previousStatus: current.status,
          holdReasons: next.holdReasons,
        },
      })
      return row!
    }
  )
}

export async function clearHold(input: {
  payoutStateId: string
  reason: HoldReason
  actorUserId: string | null
  staffReason?: string
}): Promise<{ row: PayoutRow; remaining: HoldReason[] }> {
  const probe = await withPlatformAdminContext(async (tx) =>
    loadPayout(tx, input.payoutStateId)
  )
  return withAudit(
    { orgId: probe.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const current = await loadPayout(tx, input.payoutStateId)
      const next = clearHoldSet({
        holdReasons: current.holdReasons ?? [],
        heldFromStatus: current.heldFromStatus,
        reason: input.reason,
      })
      const restored: PayoutStatus =
        next.status ??
        (next.holdReasons.length === 0 ? "pending" : current.status)
      const [updated] = await tx
        .update(main.payoutStates)
        .set({
          status: restored,
          holdReasons: next.holdReasons,
          heldFromStatus: next.heldFromStatus,
          updatedAt: new Date(),
        })
        .where(eq(main.payoutStates.id, input.payoutStateId))
        .returning()
      await ctx.emit({
        entity: "payout",
        action: next.holdReasons.length === 0 ? "released" : "held",
        entityId: input.payoutStateId,
        payload: {
          cleared: input.reason,
          remaining: next.remaining,
          previousStatus: current.status,
          nextStatus: restored,
          staffReason: input.staffReason ?? null,
        },
      })
      return { row: updated!, remaining: next.remaining }
    }
  )
}

export async function releaseHold(input: {
  payoutStateId: string
  actorUserId: string
  reason: string
}): Promise<{ row: PayoutRow; remaining: HoldReason[] }> {
  if (!input.reason.trim()) {
    throw new PayoutError("REASON_REQUIRED", "Reason is required", 400)
  }
  return clearHold({
    payoutStateId: input.payoutStateId,
    reason: "manual",
    actorUserId: input.actorUserId,
    staffReason: input.reason,
  })
}

export async function approvePayout(input: {
  payoutStateId: string
  actorUserId: string
  reason: string
}): Promise<PayoutRow> {
  if (!input.reason.trim()) {
    throw new PayoutError("REASON_REQUIRED", "Reason is required", 400)
  }
  const current = await withPlatformAdminContext(async (tx) =>
    loadPayout(tx, input.payoutStateId)
  )
  const [payment] = await withOrgContext(current.orgId, async (tx) =>
    tx
      .select({ disputeStatus: main.bookingPayments.disputeStatus })
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, current.bookingPaymentId))
      .limit(1)
  )
  if (payment?.disputeStatus === "open") {
    throw new PayoutError(
      "DISPUTE_OPEN",
      "Cannot approve while a dispute is open"
    )
  }
  if (current.status !== "approval_required") {
    throw new PayoutError(
      "NOT_APPROVAL_REQUIRED",
      "Payout is not awaiting approval"
    )
  }
  const now = new Date()
  const nextStatus: PayoutStatus =
    now.getTime() >= current.eligibleAt.getTime() ? "scheduled" : "pending"
  return withAudit(
    { orgId: current.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(main.payoutStates)
        .set({
          status: nextStatus,
          approvedBy: input.actorUserId,
          approvedAt: now,
          scheduledFor: current.eligibleAt,
          updatedAt: now,
        })
        .where(eq(main.payoutStates.id, input.payoutStateId))
        .returning()
      await ctx.emit({
        entity: "payout",
        action: "approved",
        entityId: input.payoutStateId,
        payload: {
          reason: input.reason,
          previousStatus: current.status,
          nextStatus,
        },
      })
      return row!
    }
  )
}

export async function executeTransfer(payoutStateId: string): Promise<{
  status: "transferred" | "failed" | "skipped"
  stripeTransferId: string | null
}> {
  const current = await withPlatformAdminContext(async (tx) =>
    loadPayout(tx, payoutStateId)
  )
  if (current.status !== "scheduled") {
    return { status: "skipped", stripeTransferId: current.stripeTransferId }
  }
  if (new Date().getTime() < current.eligibleAt.getTime()) {
    return { status: "skipped", stripeTransferId: null }
  }
  const [payment] = await withOrgContext(current.orgId, async (tx) =>
    tx
      .select()
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, current.bookingPaymentId))
      .limit(1)
  )
  if (!payment?.stripeChargeId) {
    throw new PayoutError("CHARGE_MISSING", "No charge id on booking payment")
  }

  const transferAmount = current.amountCents - current.reversedCents
  if (transferAmount <= 0) {
    return { status: "skipped", stripeTransferId: current.stripeTransferId }
  }

  let transferId: string
  try {
    const transfer = await stripe().transfers.create(
      {
        amount: transferAmount,
        currency: "eur",
        destination: current.destinationConnectAccountId,
        transfer_group: payment.bookingId,
        source_transaction: payment.stripeChargeId,
        metadata: {
          payout_state_id: current.id,
          booking_payment_id: current.bookingPaymentId,
        },
      },
      { idempotencyKey: current.transferIdempotencyKey }
    )
    transferId = transfer.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const attempts = current.attempts + 1
    await withAudit(
      { orgId: current.orgId, actorUserId: null },
      async (tx, ctx) => {
        await tx
          .update(main.payoutStates)
          .set({
            status: attempts >= TRANSFER_MAX_ATTEMPTS ? "failed" : "scheduled",
            attempts,
            lastError: message.slice(0, 2000),
            updatedAt: new Date(),
          })
          .where(eq(main.payoutStates.id, payoutStateId))
        await ctx.emit({
          entity: "payout",
          action: "failed",
          entityId: payoutStateId,
          payload: { attempts, lastError: message.slice(0, 200) },
        })
      }
    )
    if (attempts >= TRANSFER_MAX_ATTEMPTS) {
      await withPlatformAdminContext(async (tx) => {
        await tx.insert(main.workflowDeadLetters).values({
          orgId: current.orgId,
          workflowName: "process-expert-transfers",
          entityId: current.id,
          payload: { payoutStateId, lastError: message.slice(0, 500) },
          attempts,
          lastError: message.slice(0, 2000),
        })
      })
    }
    void captureException(err, { payoutStateId, probe: "execute-transfer" })
    return { status: "failed", stripeTransferId: null }
  }

  await withAudit(
    { orgId: current.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.payoutStates)
        .set({
          status: "transferred",
          stripeTransferId: transferId,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(main.payoutStates.id, payoutStateId))
      await ctx.emit({
        entity: "payout",
        action: "transferred",
        entityId: payoutStateId,
        payload: { stripeTransferId: transferId },
      })
    }
  )
  return { status: "transferred", stripeTransferId: transferId }
}

export async function markPayoutPaidOut(input: {
  destinationConnectAccountId: string
  stripePayoutId: string
  amountCents: number
}): Promise<string[]> {
  const rows = await payoutStatesForStripePayout(input)
  const ids: string[] = []
  for (const row of rows) {
    if (
      row.status === "paid_out" &&
      row.stripePayoutId === input.stripePayoutId
    ) {
      ids.push(row.id)
      continue
    }
    if (row.status !== "transferred") continue
    await withAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        await tx
          .update(main.payoutStates)
          .set({
            status: "paid_out",
            stripePayoutId: input.stripePayoutId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(main.payoutStates.id, row.id),
              eq(main.payoutStates.orgId, row.orgId)
            )
          )
        await ctx.emit({
          entity: "payout",
          action: "paid_out",
          entityId: row.id,
          payload: {
            stripePayoutId: input.stripePayoutId,
            amountCents: input.amountCents,
          },
        })
      }
    )
    ids.push(row.id)
  }
  return ids
}

export async function markPayoutFailedFromStripe(input: {
  destinationConnectAccountId: string
  stripePayoutId: string
  lastError: string
}): Promise<string[]> {
  const rows = await payoutStatesForStripePayout(input)
  const ids: string[] = []
  for (const row of rows) {
    if (row.status !== "transferred") continue
    await withAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        await tx
          .update(main.payoutStates)
          .set({
            status: "failed",
            stripePayoutId: input.stripePayoutId,
            lastError: input.lastError.slice(0, 2000),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(main.payoutStates.id, row.id),
              eq(main.payoutStates.orgId, row.orgId)
            )
          )
        await ctx.emit({
          entity: "payout",
          action: "failed",
          entityId: row.id,
          payload: { stripePayoutId: input.stripePayoutId },
        })
      }
    )
    ids.push(row.id)
  }
  return ids
}

async function payoutStatesForStripePayout(input: {
  destinationConnectAccountId: string
  stripePayoutId: string
}): Promise<PayoutRow[]> {
  const transferIds = await listTransferIdsForStripePayout(
    input.stripePayoutId,
    input.destinationConnectAccountId
  )
  if (transferIds.length === 0) return []
  return withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.payoutStates)
      .where(
        and(
          eq(
            main.payoutStates.destinationConnectAccountId,
            input.destinationConnectAccountId
          ),
          inArray(main.payoutStates.stripeTransferId, transferIds)
        )
      )
  )
}

export async function listTransferIdsForStripePayout(
  stripePayoutId: string,
  connectedAccountId: string
): Promise<string[]> {
  const ids = new Set<string>()
  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe().balanceTransactions.list(
      {
        payout: stripePayoutId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
      { stripeAccount: connectedAccountId }
    )
    for (const bt of page.data) {
      const source =
        typeof bt.source === "string"
          ? bt.source
          : bt.source && "id" in bt.source
            ? bt.source.id
            : null
      if (source?.startsWith("tr_")) ids.add(source)
    }
    if (!page.has_more || page.data.length === 0) break
    const lastId = page.data.at(-1)?.id
    if (!lastId || lastId === startingAfter) break
    startingAfter = lastId
  }
  return [...ids]
}

export async function listPayouts(input: {
  orgId?: string
  status?: PayoutStatus
  platformAdmin: boolean
}): Promise<PayoutRow[]> {
  const run = async (tx: Tx) => {
    const filters = []
    if (input.orgId) filters.push(eq(main.payoutStates.orgId, input.orgId))
    if (input.status) filters.push(eq(main.payoutStates.status, input.status))
    return tx
      .select()
      .from(main.payoutStates)
      .where(filters.length > 0 ? and(...filters) : undefined)
  }
  if (input.platformAdmin) {
    return withPlatformAdminContext(run)
  }
  if (!input.orgId) {
    throw new PayoutError("ORG_REQUIRED", "orgId is required", 400)
  }
  return withOrgContext(input.orgId, run)
}

export async function financeSummary(orgId: string): Promise<{
  grossCents: number
  feesCents: number
  netCents: number
  pendingCents: number
  paidCents: number
}> {
  return withOrgContext(orgId, async (tx) => {
    const payments = await tx
      .select({
        amountCents: main.bookingPayments.amountCents,
        feeCents: main.bookingPayments.applicationFeeCents,
        refundedCents: main.bookingPayments.refundedCents,
      })
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.orgId, orgId),
          inArray(main.bookingPayments.status, [
            "succeeded",
            "refunded",
            "refund_pending",
          ])
        )
      )
    const payouts = await tx
      .select({
        amountCents: main.payoutStates.amountCents,
        status: main.payoutStates.status,
      })
      .from(main.payoutStates)
      .where(eq(main.payoutStates.orgId, orgId))

    let grossCents = 0
    let feesCents = 0
    let refundedCents = 0
    for (const payment of payments) {
      grossCents += payment.amountCents
      feesCents += payment.feeCents
      refundedCents += payment.refundedCents
    }
    let pendingCents = 0
    let paidCents = 0
    for (const payout of payouts) {
      if (payout.status === "paid_out") paidCents += payout.amountCents
      if (
        payout.status === "pending" ||
        payout.status === "scheduled" ||
        payout.status === "approval_required" ||
        payout.status === "held"
      ) {
        pendingCents += payout.amountCents
      }
    }
    return {
      grossCents,
      feesCents,
      netCents: grossCents - feesCents - refundedCents,
      pendingCents,
      paidCents,
    }
  })
}

export async function listFinanceBookings(orgId: string): Promise<
  Array<{
    bookingId: string
    bookingPaymentId: string
    amountCents: number
    feeCents: number
    netCents: number
    payoutStatus: PayoutStatus | null
    eligibleAt: string | null
  }>
> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select({
        bookingId: main.bookingPayments.bookingId,
        bookingPaymentId: main.bookingPayments.id,
        amountCents: main.bookingPayments.amountCents,
        feeCents: main.bookingPayments.applicationFeeCents,
        refundedCents: main.bookingPayments.refundedCents,
        payoutStatus: main.payoutStates.status,
        eligibleAt: main.payoutStates.eligibleAt,
      })
      .from(main.bookingPayments)
      .leftJoin(
        main.payoutStates,
        eq(main.payoutStates.bookingPaymentId, main.bookingPayments.id)
      )
      .where(
        and(
          eq(main.bookingPayments.orgId, orgId),
          inArray(main.bookingPayments.status, [
            "succeeded",
            "refunded",
            "refund_pending",
          ])
        )
      )
    return rows.map((row) => ({
      bookingId: row.bookingId,
      bookingPaymentId: row.bookingPaymentId,
      amountCents: row.amountCents,
      feeCents: row.feeCents,
      netCents: row.amountCents - row.feeCents - row.refundedCents,
      payoutStatus: row.payoutStatus,
      eligibleAt: row.eligibleAt ? row.eligibleAt.toISOString() : null,
    }))
  })
}

export async function listScheduledDuePayouts(): Promise<PayoutRow[]> {
  return withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.payoutStates)
      .where(
        and(
          eq(main.payoutStates.status, "scheduled"),
          sql`${main.payoutStates.eligibleAt} <= now()`
        )
      )
  )
}

export async function promoteEligiblePendingPayouts(): Promise<number> {
  const rows = await withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.payoutStates)
      .where(
        and(
          eq(main.payoutStates.status, "pending"),
          sql`${main.payoutStates.eligibleAt} <= now()`
        )
      )
  )
  for (const row of rows) {
    await withAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        await tx
          .update(main.payoutStates)
          .set({ status: "scheduled", updatedAt: new Date() })
          .where(eq(main.payoutStates.id, row.id))
        await ctx.emit({
          entity: "payout",
          action: "scheduled",
          entityId: row.id,
          payload: { from: "pending" },
        })
      }
    )
  }
  return rows.length
}

export async function listUpcomingPayouts(
  withinHours = 48
): Promise<PayoutRow[]> {
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000)
  return withPlatformAdminContext(async (tx) =>
    tx
      .select()
      .from(main.payoutStates)
      .where(
        and(
          sql`${main.payoutStates.status} IN ('pending','scheduled')`,
          sql`${main.payoutStates.eligibleAt} <= ${cutoff}`
        )
      )
  )
}
