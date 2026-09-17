import { beforeEach, describe, expect, it, vi } from "vitest"

describe("processInvoicingRetry", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns the accounting sweep result and heartbeats", async () => {
    const retryFailedExpertInvoices = vi.fn().mockResolvedValue({
      scanned: 2,
      retried: 0,
      skipped: 1,
      blocked: 1,
      deadLettered: 0,
      errors: 0,
    })
    const heartbeat = vi.fn().mockResolvedValue(undefined)

    vi.doMock("@eleva/accounting", () => ({
      retryFailedExpertInvoices,
    }))
    vi.doMock("@eleva/observability", () => ({
      heartbeat,
    }))

    const { processInvoicingRetry } = await import("./invoicing-retry")
    await expect(processInvoicingRetry()).resolves.toEqual({
      scanned: 2,
      retried: 0,
      skipped: 1,
      blocked: 1,
      deadLettered: 0,
      errors: 0,
    })
    expect(retryFailedExpertInvoices).toHaveBeenCalledTimes(1)
    expect(heartbeat).toHaveBeenCalledWith("invoicing-retry")
  })

  it("still returns the sweep result when the heartbeat fails", async () => {
    const retryFailedExpertInvoices = vi.fn().mockResolvedValue({
      scanned: 0,
      retried: 0,
      skipped: 0,
      blocked: 0,
      deadLettered: 0,
      errors: 0,
    })
    const heartbeat = vi.fn().mockRejectedValue(new Error("betterstack down"))

    vi.doMock("@eleva/accounting", () => ({
      retryFailedExpertInvoices,
    }))
    vi.doMock("@eleva/observability", () => ({
      heartbeat,
    }))

    const { processInvoicingRetry } = await import("./invoicing-retry")
    await expect(processInvoicingRetry()).resolves.toEqual({
      scanned: 0,
      retried: 0,
      skipped: 0,
      blocked: 0,
      deadLettered: 0,
      errors: 0,
    })
    expect(heartbeat).toHaveBeenCalledWith("invoicing-retry")
  })
})
