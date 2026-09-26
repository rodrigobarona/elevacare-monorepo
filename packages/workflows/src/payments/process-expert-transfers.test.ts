import { beforeEach, describe, expect, it, vi } from "vitest"

const calls: string[] = []

vi.mock("@eleva/billing/server", () => ({
  processPendingCancellationRefunds: vi.fn(async () => {
    calls.push("refunds")
    return { scanned: 1, refunded: 1, pending: 0, failed: 0 }
  }),
  retryFailedTransferReversals: vi.fn(async () => {
    calls.push("reversals")
    return { retried: 0 }
  }),
  listScheduledDuePayouts: vi.fn(async () => {
    calls.push("list")
    return [{ id: "p1" }]
  }),
  executeTransfer: vi.fn(async () => {
    calls.push("transfer")
    return { status: "skipped", stripeTransferId: null }
  }),
}))

const { processExpertTransfers } = await import("./process-expert-transfers")

describe("processExpertTransfers", () => {
  beforeEach(() => {
    calls.length = 0
  })

  it("issues cancellation refunds before any transfer is attempted", async () => {
    const result = await processExpertTransfers()
    expect(calls).toEqual(["refunds", "reversals", "list", "transfer"])
    expect(result).toMatchObject({
      skipped: 1,
      cancellationRefunds: { refunded: 1 },
    })
  })
})
