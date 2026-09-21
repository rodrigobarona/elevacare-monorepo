import { describe, expect, it, vi } from "vitest"

const {
  sendClosedGateInvoiceNotification,
  sendBookingNotification,
  sendPaymentPayoutNotification,
} = vi.hoisted(() => ({
  sendClosedGateInvoiceNotification: vi.fn().mockResolvedValue(undefined),
  sendBookingNotification: vi.fn().mockResolvedValue(undefined),
  sendPaymentPayoutNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@eleva/notifications", () => ({
  sendClosedGateInvoiceNotification,
  sendBookingNotification,
  sendPaymentPayoutNotification,
  isClosedGateKind: (type: string) =>
    type === "invoice.blocked" ||
    type === "invoice.skipped" ||
    type === "invoice.pending",
  isBookingNotificationKind: (type: string) =>
    type === "booking.confirmed" ||
    type === "booking.cancelled" ||
    type === "booking.rescheduled",
  isPaymentPayoutNotificationKind: (type: string) =>
    type === "payment.failed" ||
    type === "payment.receipt" ||
    type === "payout.paid" ||
    type === "payout.approval_required",
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
    expect(sendPaymentPayoutNotification).not.toHaveBeenCalled()
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
    expect(sendPaymentPayoutNotification).not.toHaveBeenCalled()
  })

  it("forwards payment events to sendPaymentPayoutNotification", async () => {
    sendClosedGateInvoiceNotification.mockClear()
    sendBookingNotification.mockClear()
    sendPaymentPayoutNotification.mockClear()
    const event = {
      id: "evt-3",
      type: "payment.failed" as const,
      orgId: "org-1",
      payload: { paymentId: "pay-1" },
    }
    await handleSendNotification(event)
    expect(sendPaymentPayoutNotification).toHaveBeenCalledWith({
      id: "evt-3",
      type: "payment.failed",
      orgId: "org-1",
      payload: { paymentId: "pay-1" },
    })
    expect(sendBookingNotification).not.toHaveBeenCalled()
  })
})
