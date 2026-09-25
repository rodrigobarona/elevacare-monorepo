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

describe("processInvoicingRetry", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns both sweep results and heartbeats", async () => {
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
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    vi.doMock("@eleva/observability", () => ({ heartbeat }))

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
    expect(heartbeat).toHaveBeenCalledWith("invoicing-retry")
  })

  it("keeps the expert-invoice result when the backfill throws", async () => {
    mockAccounting({
      backfillMissingPlatformFeeInvoices: vi
        .fn()
        .mockRejectedValue(new Error("db down")),
    })
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    vi.doMock("@eleva/observability", () => ({ heartbeat }))

    const { processInvoicingRetry } = await import("./invoicing-retry")
    const result = await processInvoicingRetry()
    expect(result.scanned).toBe(0)
    expect(result.platformFeeBackfill.errors).toBe(1)
    expect(heartbeat).toHaveBeenCalledWith("invoicing-retry")
  })

  it("still returns the sweep result when the heartbeat fails", async () => {
    mockAccounting({})
    const heartbeat = vi.fn().mockRejectedValue(new Error("betterstack down"))
    vi.doMock("@eleva/observability", () => ({ heartbeat }))

    const { processInvoicingRetry } = await import("./invoicing-retry")
    await expect(processInvoicingRetry()).resolves.toEqual({
      scanned: 0,
      retried: 0,
      skipped: 0,
      blocked: 0,
      deadLettered: 0,
      errors: 0,
      platformFeeBackfill: emptyBackfill(),
    })
    expect(heartbeat).toHaveBeenCalledWith("invoicing-retry")
  })
})
