import { beforeEach, describe, expect, it, vi } from "vitest"

describe("processStripeToconlineReconciliation", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("heartbeats and does not alert on a matched run", async () => {
    const runStripeToconlineReconciliation = vi.fn().mockResolvedValue({
      month: "2026-08",
      status: "matched",
      mismatchBps: 0,
      details: { missingInvoiceCount: 0 },
    })
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    const captureException = vi.fn().mockResolvedValue(undefined)

    vi.doMock("@eleva/accounting", () => ({
      runStripeToconlineReconciliation,
    }))
    vi.doMock("@eleva/observability", () => ({
      heartbeat,
      captureException,
    }))

    const { processStripeToconlineReconciliation } =
      await import("./stripe-toconline-reconciliation")
    await expect(processStripeToconlineReconciliation()).resolves.toEqual({
      month: "2026-08",
      status: "matched",
      mismatchBps: 0,
      missingInvoiceCount: 0,
    })
    expect(captureException).not.toHaveBeenCalled()
    expect(heartbeat).toHaveBeenCalledWith("stripe-toconline-reconciliation")
  })

  it("alerts through observability when the month mismatches", async () => {
    const runStripeToconlineReconciliation = vi.fn().mockResolvedValue({
      month: "2026-08",
      status: "mismatch",
      mismatchBps: 250,
      details: { missingInvoiceCount: 2 },
    })
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    const captureException = vi.fn().mockResolvedValue(undefined)

    vi.doMock("@eleva/accounting", () => ({
      runStripeToconlineReconciliation,
    }))
    vi.doMock("@eleva/observability", () => ({
      heartbeat,
      captureException,
    }))

    const { processStripeToconlineReconciliation } =
      await import("./stripe-toconline-reconciliation")
    await expect(
      processStripeToconlineReconciliation({ month: "2026-08" })
    ).resolves.toMatchObject({ status: "mismatch", mismatchBps: 250 })
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it("heartbeats even when the mismatch alert fails", async () => {
    const runStripeToconlineReconciliation = vi.fn().mockResolvedValue({
      month: "2026-08",
      status: "mismatch",
      mismatchBps: 250,
      details: { missingInvoiceCount: 2 },
    })
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    const captureException = vi.fn().mockRejectedValue(new Error("sentry down"))

    vi.doMock("@eleva/accounting", () => ({
      runStripeToconlineReconciliation,
    }))
    vi.doMock("@eleva/observability", () => ({
      heartbeat,
      captureException,
    }))

    const { processStripeToconlineReconciliation } =
      await import("./stripe-toconline-reconciliation")
    await expect(
      processStripeToconlineReconciliation({ month: "2026-08" })
    ).resolves.toMatchObject({ status: "mismatch" })
    expect(heartbeat).toHaveBeenCalledWith("stripe-toconline-reconciliation")
  })
})
