import { beforeEach, describe, expect, it, vi } from "vitest"

const emptyBackfill = () => ({
  scanned: 0,
  recorded: { skipped: 0, blocked: 0, pending: 0, already_recorded: 0 },
  deadLettered: 0,
  errors: 0,
})

function mockAccounting(overrides: {
  retryFailedExpertInvoices?: ReturnType<typeof vi.fn>
  backfillMissingPlatformFeeInvoices?: ReturnType<typeof vi.fn>
}) {
  const retryFailedExpertInvoices =
    overrides.retryFailedExpertInvoices ??
    vi.fn().mockResolvedValue({
      scanned: 0,
      retried: 0,
      skipped: 0,
      blocked: 0,
      deadLettered: 0,
      errors: 0,
    })
  const backfillMissingPlatformFeeInvoices =
    overrides.backfillMissingPlatformFeeInvoices ??
    vi.fn().mockResolvedValue(emptyBackfill())
  vi.doMock("@eleva/accounting", () => ({
    retryFailedExpertInvoices,
    backfillMissingPlatformFeeInvoices,
    emptyPlatformFeeBackfillResult: emptyBackfill,
  }))
  return { retryFailedExpertInvoices, backfillMissingPlatformFeeInvoices }
}

const captureException = vi.fn(async () => undefined)

describe("processInvoicingRetry", () => {
  beforeEach(() => {
    vi.resetModules()
    captureException.mockClear()
    vi.doMock("@eleva/observability", () => ({ captureException }))
  })

  it("returns both sweep results", async () => {
    const backfill = {
      ...emptyBackfill(),
      scanned: 1,
      recorded: { skipped: 0, blocked: 1, pending: 0, already_recorded: 0 },
    }
    const mocks = mockAccounting({
      retryFailedExpertInvoices: vi.fn().mockResolvedValue({
        scanned: 2,
        retried: 0,
        skipped: 1,
        blocked: 1,
        deadLettered: 0,
        errors: 0,
      }),
      backfillMissingPlatformFeeInvoices: vi.fn().mockResolvedValue(backfill),
    })

    const { processInvoicingRetry } = await import("./invoicing-retry")
    await expect(processInvoicingRetry()).resolves.toEqual({
      scanned: 2,
      retried: 0,
      skipped: 1,
      blocked: 1,
      deadLettered: 0,
      errors: 0,
      platformFeeBackfill: backfill,
    })
    expect(mocks.retryFailedExpertInvoices).toHaveBeenCalledTimes(1)
    expect(mocks.backfillMissingPlatformFeeInvoices).toHaveBeenCalledTimes(1)
  })

  it("fails the run when the backfill throws, after the expert invoices were retried", async () => {
    const down = new Error("db down")
    const mocks = mockAccounting({
      backfillMissingPlatformFeeInvoices: vi.fn().mockRejectedValue(down),
    })

    const { processInvoicingRetry } = await import("./invoicing-retry")
    await expect(processInvoicingRetry()).rejects.toBe(down)
    // The first part ran before the second failed, and stands.
    expect(mocks.retryFailedExpertInvoices).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(down, {
      workflow: "invoicingRetry",
      step: "platformFeeBackfill",
    })
  })
})
