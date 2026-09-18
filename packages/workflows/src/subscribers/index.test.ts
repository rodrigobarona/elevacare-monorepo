import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./guest-activation", () => ({
  activateGuestBooking: vi.fn(),
}))

import { defaultDomainEventSubscribers } from "./index"

describe("logger subscriber", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("accepts closed-gate invoice payloads", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    const logger = defaultDomainEventSubscribers().logger
    if (!logger) throw new Error("missing logger subscriber")
    await expect(
      logger({
        id: "e1",
        type: "invoice.blocked",
        orgId: "org-1",
        payload: {
          invoiceKind: "platform_fee",
          invoiceId: "inv-1",
          bookingPaymentId: "pay-1",
          status: "blocked",
        },
      })
    ).resolves.toBeUndefined()
  })

  it("rejects invoice events missing invoiceId", async () => {
    const logger = defaultDomainEventSubscribers().logger
    if (!logger) throw new Error("missing logger subscriber")
    await expect(
      logger({
        id: "e1",
        type: "invoice.skipped",
        orgId: "org-1",
        payload: { invoiceKind: "platform_fee" },
      })
    ).rejects.toThrow(/invoiceId/)
  })
})
