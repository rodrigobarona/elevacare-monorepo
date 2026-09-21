import { describe, expect, it, vi } from "vitest"

const { sendClosedGateInvoiceNotification, sendBookingNotification } =
  vi.hoisted(() => ({
    sendClosedGateInvoiceNotification: vi.fn().mockResolvedValue(undefined),
    sendBookingNotification: vi.fn().mockResolvedValue(undefined),
  }))

vi.mock("@eleva/notifications", () => ({
  sendClosedGateInvoiceNotification,
  sendBookingNotification,
  isClosedGateKind: (type: string) =>
    type === "invoice.blocked" ||
    type === "invoice.skipped" ||
    type === "invoice.pending",
  isBookingNotificationKind: (type: string) =>
    type === "booking.confirmed" ||
    type === "booking.cancelled" ||
    type === "booking.rescheduled",
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
    expect(sendBookingNotification).not.toHaveBeenCalled()
  })

  it("forwards booking events to sendBookingNotification", async () => {
    sendClosedGateInvoiceNotification.mockClear()
    sendBookingNotification.mockClear()
    const event = {
      id: "evt-2",
      type: "booking.confirmed" as const,
      orgId: "org-1",
      payload: { bookingId: "booking-1" },
    }
    await handleSendNotification(event)
    expect(sendBookingNotification).toHaveBeenCalledWith({
      id: "evt-2",
      type: "booking.confirmed",
      orgId: "org-1",
      payload: { bookingId: "booking-1" },
    })
    expect(sendClosedGateInvoiceNotification).not.toHaveBeenCalled()
  })
})
