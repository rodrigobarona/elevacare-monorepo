import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import type {
  AccountingReconciliationDetails,
  AccountingReconciliationRun,
} from "@eleva/db/schema"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"
import type { ExpertInvoiceStatus } from "./invoice-ops"
import { parseSaftMonth, saftMonthRange } from "./saft-export"

export const RECONCILIATION_MISMATCH_THRESHOLD_BPS = 10
export const RECONCILIATION_WORKFLOW_NAME = "stripe-toconline-reconciliation"

const PAID_PAYMENT_STATUSES = [
  "succeeded",
  "refunded",
  "refund_pending",
] as const

export type PaymentLedgerRow = {
  bookingId: string
  expertOrgId: string
  amountCents: number
  refundedCents: number
  applicationFeeCents: number
}

export type InvoiceLedgerRow = {
  bookingId: string
  expertOrgId: string
  amountCents: number
  status: ExpertInvoiceStatus
  error: string | null
}

export type ReconciliationSummary = {
  stripeGrossCents: number
  stripeFeeTotalCents: number
  invoicedTotalCents: number
  mismatchBps: number
  status: "matched" | "mismatch"
  details: AccountingReconciliationDetails
}

export type PublicAccountingReconciliationRun = {
  id: string
  month: string
  stripeFeeTotalCents: number
  invoicedTotalCents: number
  mismatchBps: number
  status: "matched" | "mismatch"
  details: AccountingReconciliationDetails
  createdAt: string
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function previousLisbonMonth(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
  })
  const bag = Object.fromEntries(
    fmt.formatToParts(now).map((part) => [part.type, part.value])
  )
  const year = Number(bag.year)
  const month = Number(bag.month)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${pad2(prevMonth)}`
}

export function netCents(amountCents: number, refundedCents: number): number {
  return Math.max(0, amountCents - refundedCents)
}

export function netFeeCents(input: {
  applicationFeeCents: number
  amountCents: number
  refundedCents: number
}): number {
  if (input.amountCents <= 0) return 0
  return Math.round(
    (input.applicationFeeCents *
      netCents(input.amountCents, input.refundedCents)) /
      input.amountCents
  )
}

function isIssuedExportStatus(status: ExpertInvoiceStatus): boolean {
  switch (status) {
    case "issued":
    case "manual_issued":
      return true
    case "pending":
    case "failed":
    case "manual_pending":
      return false
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function mismatchBps(
  expectedCents: number,
  actualCents: number
): number {
  if (expectedCents === 0 && actualCents === 0) return 0
  if (expectedCents === 0) return 10_000
  return Math.round(
    (Math.abs(expectedCents - actualCents) / expectedCents) * 10_000
  )
}

function ledgerKey(row: { bookingId: string; expertOrgId: string }): string {
  return `${row.bookingId}:${row.expertOrgId}`
}

export function summarizeReconciliation(
  payments: readonly PaymentLedgerRow[],
  invoices: readonly InvoiceLedgerRow[]
): ReconciliationSummary {
  const invoiceByLedger = new Map<string, InvoiceLedgerRow>()
  for (const invoice of invoices) {
    invoiceByLedger.set(ledgerKey(invoice), invoice)
  }

  let stripeGrossCents = 0
  let stripeFeeTotalCents = 0
  let invoicedTotalCents = 0
  let issuedExportCents = 0
  let missingInvoiceCount = 0
  let amountMismatchCount = 0
  let failedInvoiceCount = 0
  let pendingInvoiceCount = 0
  let blockedInvoiceCount = 0

  for (const invoice of invoices) {
    invoicedTotalCents += invoice.amountCents
    if (isIssuedExportStatus(invoice.status)) {
      issuedExportCents += invoice.amountCents
    }
  }

  const paidKeys = new Set<string>()
  for (const payment of payments) {
    paidKeys.add(ledgerKey(payment))
    const net = netCents(payment.amountCents, payment.refundedCents)
    stripeGrossCents += net
    stripeFeeTotalCents += netFeeCents(payment)
    const invoice = invoiceByLedger.get(ledgerKey(payment))
    if (!invoice) {
      missingInvoiceCount += 1
      continue
    }
    if (invoice.amountCents !== net) amountMismatchCount += 1
    switch (invoice.status) {
      case "failed":
        failedInvoiceCount += 1
        break
      case "pending":
      case "manual_pending":
        pendingInvoiceCount += 1
        break
      case "issued":
      case "manual_issued":
        break
      default: {
        const _exhaustive: never = invoice.status
        void _exhaustive
      }
    }
    if (invoice.error === TOC_V1_AUTO_FINALIZE_BLOCKED) {
      blockedInvoiceCount += 1
    }
  }

  let extraInvoiceCount = 0
  for (const invoice of invoices) {
    if (!paidKeys.has(ledgerKey(invoice))) extraInvoiceCount += 1
  }

  const bps = mismatchBps(stripeGrossCents, invoicedTotalCents)
  // While the v1 issuance gate is closed, status is row existence only.
  // Amount and bps stay on the run as informational details.
  const status: "matched" | "mismatch" =
    missingInvoiceCount > 0 || extraInvoiceCount > 0 ? "mismatch" : "matched"

  return {
    stripeGrossCents,
    stripeFeeTotalCents,
    invoicedTotalCents,
    mismatchBps: bps,
    status,
    details: {
      comparison: "expert_invoices",
      issuanceGateClosed: true,
      stripeGrossCents,
      invoicedCents: invoicedTotalCents,
      issuedExportCents,
      missingInvoiceCount,
      extraInvoiceCount,
      amountMismatchCount,
      failedInvoiceCount,
      pendingInvoiceCount,
      blockedInvoiceCount,
      tier1Skipped: true,
    },
  }
}

function toPublicRun(
  row: AccountingReconciliationRun
): PublicAccountingReconciliationRun {
  return {
    id: row.id,
    month: row.month,
    stripeFeeTotalCents: row.stripeFeeTotalCents,
    invoicedTotalCents: row.invoicedTotalCents,
    mismatchBps: row.mismatchBps,
    status: row.status,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getAccountingReconciliation(input: {
  month?: string
}): Promise<PublicAccountingReconciliationRun | null> {
  if (input.month) parseSaftMonth(input.month)

  const row = await withPlatformAdminContext(async (tx) => {
    if (input.month) {
      const [match] = await tx
        .select()
        .from(main.accountingReconciliationRuns)
        .where(eq(main.accountingReconciliationRuns.month, input.month))
        .limit(1)
      return match ?? null
    }
    const [latest] = await tx
      .select()
      .from(main.accountingReconciliationRuns)
      .orderBy(
        desc(main.accountingReconciliationRuns.month),
        desc(main.accountingReconciliationRuns.createdAt)
      )
      .limit(1)
    return latest ?? null
  })

  return row ? toPublicRun(row) : null
}

export async function loadLedgers(
  month: string
): Promise<{ payments: PaymentLedgerRow[]; invoices: InvoiceLedgerRow[] }> {
  parseSaftMonth(month)
  const range = saftMonthRange(month)

  return withPlatformAdminContext(async (tx) => {
    const paymentsPromise = tx
      .select({
        bookingId: main.bookingPayments.bookingId,
        expertOrgId: main.bookingPayments.orgId,
        amountCents: main.bookingPayments.amountCents,
        refundedCents: main.bookingPayments.refundedCents,
        applicationFeeCents: main.bookingPayments.applicationFeeCents,
      })
      .from(main.bookingPayments)
      .where(
        and(
          gte(main.bookingPayments.paidAt, range.start),
          lt(main.bookingPayments.paidAt, range.end),
          inArray(main.bookingPayments.status, [...PAID_PAYMENT_STATUSES])
        )
      )

    const invoicesPromise = tx
      .select({
        bookingId: main.expertInvoices.bookingId,
        expertOrgId: main.expertInvoices.expertOrgId,
        amountCents: main.expertInvoices.amountCents,
        status: main.expertInvoices.status,
        error: main.expertInvoices.error,
      })
      .from(main.expertInvoices)
      .where(
        and(
          gte(main.expertInvoices.createdAt, range.start),
          lt(main.expertInvoices.createdAt, range.end)
        )
      )

    const [payments, invoices] = await Promise.all([
      paymentsPromise,
      invoicesPromise,
    ])
    return { payments, invoices }
  })
}

export async function runStripeToconlineReconciliation(input: {
  month?: string
  now?: Date
}): Promise<PublicAccountingReconciliationRun> {
  const month = input.month ?? previousLisbonMonth(input.now ?? new Date())
  parseSaftMonth(month)
  const { payments, invoices } = await loadLedgers(month)
  const summary = summarizeReconciliation(payments, invoices)

  const staffOrgId = await withPlatformAdminContext(async (tx) => {
    const [staff] = await tx
      .select({ id: auth.organization.id })
      .from(auth.organization)
      .where(eq(auth.organization.type, "staff"))
      .limit(1)
    return staff?.id
  })
  if (!staffOrgId) {
    throw new Error("reconciliation_audit_org_missing")
  }

  return withPlatformAudit(
    { orgId: staffOrgId, actorUserId: null },
    async (tx, ctx) => {
      const values = {
        month,
        stripeFeeTotalCents: summary.stripeFeeTotalCents,
        invoicedTotalCents: summary.invoicedTotalCents,
        mismatchBps: summary.mismatchBps,
        status: summary.status,
        details: summary.details,
      }

      const [persisted] = await tx
        .insert(main.accountingReconciliationRuns)
        .values(values)
        .onConflictDoUpdate({
          target: main.accountingReconciliationRuns.month,
          set: {
            stripeFeeTotalCents: values.stripeFeeTotalCents,
            invoicedTotalCents: values.invoicedTotalCents,
            mismatchBps: values.mismatchBps,
            status: values.status,
            details: values.details,
          },
        })
        .returning({
          id: main.accountingReconciliationRuns.id,
          month: main.accountingReconciliationRuns.month,
          stripeFeeTotalCents:
            main.accountingReconciliationRuns.stripeFeeTotalCents,
          invoicedTotalCents:
            main.accountingReconciliationRuns.invoicedTotalCents,
          mismatchBps: main.accountingReconciliationRuns.mismatchBps,
          status: main.accountingReconciliationRuns.status,
          details: main.accountingReconciliationRuns.details,
          createdAt: main.accountingReconciliationRuns.createdAt,
          inserted: sql<boolean>`(xmax = 0)`,
        })

      if (!persisted) {
        throw new Error("reconciliation_run_persist_failed")
      }

      const { inserted, ...row } = persisted

      await ctx.emit({
        entity: "accounting_reconciliation_run",
        action: inserted ? "created" : "updated",
        entityId: row.id,
        payload: {
          month,
          status: summary.status,
          mismatchBps: summary.mismatchBps,
          missingInvoiceCount: summary.details.missingInvoiceCount,
          tier1Skipped: true,
        },
      })

      return toPublicRun(row)
    }
  )
}
