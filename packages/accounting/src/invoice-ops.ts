import { and, desc, eq, inArray, lt, or } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgContext } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import { issueExpertServiceInvoice } from "./dispatch"
import type { InvoicingProviderSlug } from "./types"

export type ExpertInvoiceStatus =
  (typeof main.expertInvoices.$inferSelect)["status"]

export type PublicExpertInvoice = {
  id: string
  bookingId: string
  adapter: InvoicingProviderSlug
  status: ExpertInvoiceStatus
  amountCents: number
  number: string | null
  issuedAt: string | null
  error: string | null
  attempts: number
  pdfUrl: string | null
}

export type ExpertInvoiceOpCode =
  | "not_found"
  | "flag_disabled"
  | "already_issued"
  | "not_retryable"
  | "already_manual"
  | "payment_not_succeeded"

export class ExpertInvoiceOpError extends Error {
  readonly code: ExpertInvoiceOpCode
  readonly status: 403 | 404 | 409

  constructor(code: ExpertInvoiceOpCode, message: string) {
    super(message)
    this.name = "ExpertInvoiceOpError"
    this.code = code
    this.status =
      code === "not_found" ? 404 : code === "flag_disabled" ? 403 : 409
  }
}

export function isExpertInvoiceOpError(
  err: unknown
): err is ExpertInvoiceOpError {
  return err instanceof ExpertInvoiceOpError
}

export function canRetryInvoice(status: ExpertInvoiceStatus): boolean {
  switch (status) {
    case "failed":
      return true
    case "pending":
    case "issued":
    case "manual_pending":
    case "manual_issued":
      return false
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function canMarkInvoiceManual(status: ExpertInvoiceStatus): boolean {
  switch (status) {
    case "failed":
    case "manual_pending":
      return true
    case "pending":
    case "issued":
    case "manual_issued":
      return false
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function retryConflictCode(
  status: ExpertInvoiceStatus
): Extract<ExpertInvoiceOpCode, "already_issued" | "not_retryable"> {
  switch (status) {
    case "issued":
    case "manual_issued":
      return "already_issued"
    case "manual_pending":
    case "failed":
    case "pending":
      return "not_retryable"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function markManualConflictCode(
  status: ExpertInvoiceStatus
): Extract<ExpertInvoiceOpCode, "already_issued" | "already_manual"> {
  switch (status) {
    case "manual_issued":
      return "already_manual"
    case "issued":
    case "failed":
    case "pending":
    case "manual_pending":
      return "already_issued"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function toPublicExpertInvoice(row: {
  id: string
  bookingId: string
  adapter: InvoicingProviderSlug
  status: ExpertInvoiceStatus
  amountCents: number
  number: string | null
  issuedAt: Date | null
  error: string | null
  attempts: number
  pdfUrl: string | null
}): PublicExpertInvoice {
  return {
    id: row.id,
    bookingId: row.bookingId,
    adapter: row.adapter,
    status: row.status,
    amountCents: row.amountCents,
    number: row.number,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    error: row.error,
    attempts: row.attempts,
    pdfUrl: row.pdfUrl,
  }
}

const invoiceSelect = {
  id: main.expertInvoices.id,
  bookingId: main.expertInvoices.bookingId,
  adapter: main.expertInvoices.adapter,
  status: main.expertInvoices.status,
  amountCents: main.expertInvoices.amountCents,
  number: main.expertInvoices.number,
  issuedAt: main.expertInvoices.issuedAt,
  error: main.expertInvoices.error,
  attempts: main.expertInvoices.attempts,
  pdfUrl: main.expertInvoices.pdfUrl,
}

export const EXPERT_INVOICE_PAGE_SIZE = 100

export async function listExpertInvoices(input: {
  orgId: string
  status?: ExpertInvoiceStatus
  cursor?: string
}): Promise<{ invoices: PublicExpertInvoice[]; nextCursor: string | null }> {
  return withOrgContext(input.orgId, async (tx) => {
    const filters = [eq(main.expertInvoices.expertOrgId, input.orgId)]
    if (input.status) {
      filters.push(eq(main.expertInvoices.status, input.status))
    }
    if (input.cursor) {
      const [cursorRow] = await tx
        .select({
          id: main.expertInvoices.id,
          createdAt: main.expertInvoices.createdAt,
        })
        .from(main.expertInvoices)
        .where(
          and(
            eq(main.expertInvoices.id, input.cursor),
            eq(main.expertInvoices.expertOrgId, input.orgId)
          )
        )
        .limit(1)
      if (!cursorRow) {
        return { invoices: [], nextCursor: null }
      }
      const older = or(
        lt(main.expertInvoices.createdAt, cursorRow.createdAt),
        and(
          eq(main.expertInvoices.createdAt, cursorRow.createdAt),
          lt(main.expertInvoices.id, cursorRow.id)
        )
      )
      if (older) filters.push(older)
    }

    const rows = await tx
      .select(invoiceSelect)
      .from(main.expertInvoices)
      .where(and(...filters))
      .orderBy(
        desc(main.expertInvoices.createdAt),
        desc(main.expertInvoices.id)
      )
      .limit(EXPERT_INVOICE_PAGE_SIZE + 1)

    const page = rows.slice(0, EXPERT_INVOICE_PAGE_SIZE)
    return {
      invoices: page.map((row) =>
        toPublicExpertInvoice({
          ...row,
          adapter: row.adapter as InvoicingProviderSlug,
        })
      ),
      nextCursor:
        rows.length > EXPERT_INVOICE_PAGE_SIZE
          ? (page[page.length - 1]?.id ?? null)
          : null,
    }
  })
}

export async function retryExpertInvoice(input: {
  bookingId: string
  orgId: string
  actorUserId: string
}): Promise<PublicExpertInvoice> {
  const appsEnabled = await getFlag("ff.expert_invoicing_apps_enabled")
  if (!appsEnabled) {
    throw new ExpertInvoiceOpError(
      "flag_disabled",
      "expert invoicing apps are not enabled"
    )
  }

  const snapshot = await loadInvoiceSnapshot(input)
  if (!snapshot) {
    throw new ExpertInvoiceOpError("not_found", "expert invoice not found")
  }
  if (!canRetryInvoice(snapshot.invoice.status)) {
    throw new ExpertInvoiceOpError(
      retryConflictCode(snapshot.invoice.status),
      "invoice cannot be retried"
    )
  }
  if (!snapshot.payment || snapshot.payment.status !== "succeeded") {
    throw new ExpertInvoiceOpError(
      "payment_not_succeeded",
      "booking payment is not succeeded"
    )
  }

  const claimed = await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(main.expertInvoices)
        .set({
          status: "pending",
          error: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(main.expertInvoices.id, snapshot.invoice.id),
            eq(main.expertInvoices.status, "failed")
          )
        )
        .returning({ id: main.expertInvoices.id })
      await ctx.emit({
        entity: "invoice",
        action: "status_changed",
        entityId: snapshot.invoice.id,
        payload: {
          bookingId: input.bookingId,
          from: "failed",
          to: "pending",
          retried: true,
          claimed: Boolean(row),
        },
      })
      return Boolean(row)
    }
  )

  if (!claimed) {
    throw new ExpertInvoiceOpError("not_retryable", "invoice cannot be retried")
  }

  const dispatch = await issueExpertServiceInvoice({
    bookingPaymentId: snapshot.payment.id,
    orgId: input.orgId,
  })
  if (dispatch.skipped) {
    await restoreFailedAfterSkippedDispatch({
      invoiceId: snapshot.invoice.id,
      bookingId: input.bookingId,
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      reason: dispatch.reason,
    })
    throw skippedDispatchError(dispatch.reason)
  }

  const latest = await loadInvoiceSnapshot(input)
  if (!latest) {
    throw new ExpertInvoiceOpError("not_found", "expert invoice not found")
  }
  return toPublicExpertInvoice({
    ...latest.invoice,
    adapter: latest.invoice.adapter as InvoicingProviderSlug,
  })
}

export async function markExpertInvoiceManual(input: {
  bookingId: string
  orgId: string
  actorUserId: string
}): Promise<PublicExpertInvoice> {
  const snapshot = await loadInvoiceSnapshot(input)
  if (!snapshot) {
    throw new ExpertInvoiceOpError("not_found", "expert invoice not found")
  }
  if (!canMarkInvoiceManual(snapshot.invoice.status)) {
    throw new ExpertInvoiceOpError(
      markManualConflictCode(snapshot.invoice.status),
      "invoice cannot be marked issued manually"
    )
  }

  const issuedAt = new Date()
  const updated = await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(main.expertInvoices)
        .set({
          status: "manual_issued",
          issuedAt,
          error: null,
          updatedAt: issuedAt,
        })
        .where(
          and(
            eq(main.expertInvoices.id, snapshot.invoice.id),
            inArray(main.expertInvoices.status, ["failed", "manual_pending"])
          )
        )
        .returning(invoiceSelect)
      await ctx.emit({
        entity: "invoice",
        action: "manual_marked",
        entityId: snapshot.invoice.id,
        payload: {
          bookingId: input.bookingId,
          from: snapshot.invoice.status,
          to: "manual_issued",
          updated: Boolean(row),
        },
      })
      return row ?? null
    }
  )

  if (!updated) {
    throw new ExpertInvoiceOpError(
      "already_issued",
      "invoice cannot be marked issued manually"
    )
  }

  return toPublicExpertInvoice({
    ...updated,
    adapter: updated.adapter as InvoicingProviderSlug,
  })
}

function skippedDispatchError(reason: string): ExpertInvoiceOpError {
  if (reason === "flag_disabled") {
    return new ExpertInvoiceOpError(
      "flag_disabled",
      "expert invoicing apps are not enabled"
    )
  }
  return new ExpertInvoiceOpError(
    "not_retryable",
    "invoice dispatch did not start"
  )
}

async function restoreFailedAfterSkippedDispatch(input: {
  invoiceId: string
  bookingId: string
  orgId: string
  actorUserId: string
  reason: string
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(main.expertInvoices)
        .set({
          status: "failed",
          error: input.reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(main.expertInvoices.id, input.invoiceId),
            eq(main.expertInvoices.status, "pending")
          )
        )
        .returning({ id: main.expertInvoices.id })
      await ctx.emit({
        entity: "invoice",
        action: "status_changed",
        entityId: input.invoiceId,
        payload: {
          bookingId: input.bookingId,
          from: "pending",
          to: "failed",
          skippedDispatch: true,
          reason: input.reason,
          restored: Boolean(row),
        },
      })
    }
  )
}

async function loadInvoiceSnapshot(input: {
  bookingId: string
  orgId: string
}) {
  return withOrgContext(input.orgId, async (tx) => {
    const [invoice] = await tx
      .select(invoiceSelect)
      .from(main.expertInvoices)
      .where(
        and(
          eq(main.expertInvoices.bookingId, input.bookingId),
          eq(main.expertInvoices.expertOrgId, input.orgId)
        )
      )
      .limit(1)
    if (!invoice) return null
    const [payment] = await tx
      .select({
        id: main.bookingPayments.id,
        status: main.bookingPayments.status,
      })
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.bookingId, input.bookingId),
          eq(main.bookingPayments.orgId, input.orgId)
        )
      )
      .limit(1)
    return { invoice, payment: payment ?? null }
  })
}
