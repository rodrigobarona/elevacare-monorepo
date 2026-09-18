import { describe, expect, it, vi } from "vitest"

const { sendClosedGateInvoiceNotification } = vi.hoisted(() => ({
  sendClosedGateInvoiceNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@eleva/notifications", () => ({
  sendClosedGateInvoiceNotification,
}))

import { handleSendNotification } from "./send-notification"

describe("handleSendNotification", () => {
  it("forwards closed-gate invoice events to the notifications package", async () => {
    const event = {
      id: "evt-1",
      type: "invoice.pending" as const,
      orgId: "org-1",
      payload: { invoiceId: "inv-1" },
    }
    await handleSendNotification(event)
    expect(sendClosedGateInvoiceNotification).toHaveBeenCalledWith({
      id: "evt-1",
      type: "invoice.pending",
      orgId: "org-1",
      payload: { invoiceId: "inv-1" },
    })
  })
})
