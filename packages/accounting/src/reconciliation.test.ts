import { beforeEach, describe, expect, it, vi } from "vitest"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"
import {
  RECONCILIATION_MISMATCH_THRESHOLD_BPS,
  mismatchBps,
  netCents,
  netFeeCents,
  previousLisbonMonth,
  summarizeReconciliation,
  type InvoiceLedgerRow,
  type PaymentLedgerRow,
} from "./reconciliation"

const PAYMENT: PaymentLedgerRow = {
  bookingId: "00000000-0000-4000-8000-000000000001",
  expertOrgId: "00000000-0000-4000-8000-000000000010",
  amountCents: 10_000,
  refundedCents: 0,
  applicationFeeCents: 1_500,
}

function invoice(overrides: Partial<InvoiceLedgerRow> = {}): InvoiceLedgerRow {
  return {
    bookingId: PAYMENT.bookingId,
    expertOrgId: PAYMENT.expertOrgId,
    amountCents: 10_000,
    status: "pending",
    error: TOC_V1_AUTO_FINALIZE_BLOCKED,
    ...overrides,
  }
}

describe("previousLisbonMonth", () => {
  it("returns August for 1 Sep 05:00 Lisbon", () => {
    expect(previousLisbonMonth(new Date("2026-09-01T04:00:00.000Z"))).toBe(
      "2026-08"
    )
  })
})

describe("netCents / netFeeCents", () => {
  it("nets refunds proportionally onto the platform fee", () => {
    expect(netCents(10_000, 2_000)).toBe(8_000)
    expect(
      netFeeCents({
        applicationFeeCents: 1_500,
        amountCents: 10_000,
        refundedCents: 2_000,
      })
    ).toBe(1_200)
  })
})

describe("mismatchBps", () => {
  it("is 0 when both sides are empty", () => {
    expect(mismatchBps(0, 0)).toBe(0)
  })

  it("treats 0.1% as 10 bps", () => {
    expect(mismatchBps(10_000, 9_990)).toBe(10)
    expect(mismatchBps(10_000, 9_989)).toBe(11)
    expect(RECONCILIATION_MISMATCH_THRESHOLD_BPS).toBe(10)
  })
})

describe("summarizeReconciliation", () => {
  it("matches a seeded month when the invoice row covers the payment", () => {
    const summary = summarizeReconciliation([PAYMENT], [invoice()])
    expect(summary.status).toBe("matched")
    expect(summary.mismatchBps).toBe(0)
    expect(summary.stripeFeeTotalCents).toBe(1_500)
    expect(summary.invoicedTotalCents).toBe(10_000)
    expect(summary.details.tier1Skipped).toBe(true)
    expect(summary.details.issuanceGateClosed).toBe(true)
    expect(summary.details.blockedInvoiceCount).toBe(1)
    expect(summary.details.issuedExportCents).toBe(0)
  })

  it("does not treat the closed issuance gate as a mismatch", () => {
    const summary = summarizeReconciliation(
      [PAYMENT],
      [invoice({ status: "failed", error: TOC_V1_AUTO_FINALIZE_BLOCKED })]
    )
    expect(summary.status).toBe("matched")
    expect(summary.details.failedInvoiceCount).toBe(1)
  })

  it("flags a missing invoice as a mismatch", () => {
    const summary = summarizeReconciliation([PAYMENT], [])
    expect(summary.status).toBe("mismatch")
    expect(summary.details.missingInvoiceCount).toBe(1)
    expect(summary.mismatchBps).toBe(10_000)
  })

  it("keeps amount mismatches informational while the issuance gate is closed", () => {
    const summary = summarizeReconciliation(
      [PAYMENT],
      [invoice({ amountCents: 9_000 })]
    )
    expect(summary.status).toBe("matched")
    expect(summary.details.amountMismatchCount).toBe(1)
    expect(summary.mismatchBps).toBe(1_000)
  })

  it("flags an invoice-only month as extra, not matched", () => {
    const summary = summarizeReconciliation([], [invoice()])
    expect(summary.status).toBe("mismatch")
    expect(summary.details.extraInvoiceCount).toBe(1)
    expect(summary.details.missingInvoiceCount).toBe(0)
    expect(summary.invoicedTotalCents).toBe(10_000)
    expect(summary.mismatchBps).toBe(10_000)
  })

  it("counts issued rows toward the SAF-T export total", () => {
    const summary = summarizeReconciliation(
      [PAYMENT],
      [invoice({ status: "manual_issued", error: null })]
    )
    expect(summary.status).toBe("matched")
    expect(summary.details.issuedExportCents).toBe(10_000)
  })

  it("flags an invoice without a paid booking as extra", () => {
    const summary = summarizeReconciliation(
      [PAYMENT],
      [
        invoice(),
        invoice({
          bookingId: "00000000-0000-4000-8000-000000000099",
        }),
      ]
    )
    expect(summary.status).toBe("mismatch")
    expect(summary.details.extraInvoiceCount).toBe(1)
  })

  it("treats a different expert org on the same booking as missing and extra", () => {
    const summary = summarizeReconciliation(
      [PAYMENT],
      [
        invoice({
          expertOrgId: "00000000-0000-4000-8000-000000000011",
        }),
      ]
    )
    expect(summary.status).toBe("mismatch")
    expect(summary.details.missingInvoiceCount).toBe(1)
    expect(summary.details.extraInvoiceCount).toBe(1)
  })
})

describe("loadLedgers", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("loads invoices for the month even when no paid payments exist", async () => {
    const invoiceRow = {
      bookingId: PAYMENT.bookingId,
      expertOrgId: PAYMENT.expertOrgId,
      amountCents: 10_000,
      status: "pending" as const,
      error: TOC_V1_AUTO_FINALIZE_BLOCKED,
    }
    const bookingPayments = {
      bookingId: "bookingId",
      orgId: "orgId",
      amountCents: "amountCents",
      refundedCents: "refundedCents",
      applicationFeeCents: "applicationFeeCents",
      paidAt: "paidAt",
      status: "status",
    }
    const expertInvoices = {
      bookingId: "bookingId",
      expertOrgId: "expertOrgId",
      amountCents: "amountCents",
      status: "status",
      error: "error",
      createdAt: "createdAt",
    }
    const queried: unknown[] = []

    vi.doMock("@eleva/db", () => ({
      auth: { organization: { id: "id", type: "type" } },
      main: {
        bookingPayments,
        expertInvoices,
        accountingReconciliationRuns: {},
      },
      withPlatformAdminContext: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: (table: unknown) => {
              queried.push(table)
              return {
                where: () =>
                  table === bookingPayments
                    ? Promise.resolve([])
                    : Promise.resolve([invoiceRow]),
              }
            },
          }),
        })
      ),
    }))
    vi.doMock("@eleva/audit", () => ({
      withPlatformAudit: vi.fn(),
    }))

    const { loadLedgers } = await import("./reconciliation")
    const ledgers = await loadLedgers("2026-08")

    expect(queried).toContain(bookingPayments)
    expect(queried).toContain(expertInvoices)
    expect(ledgers.payments).toEqual([])
    expect(ledgers.invoices).toEqual([invoiceRow])
  })
})
