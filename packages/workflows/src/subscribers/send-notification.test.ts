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
  parseBookingNotificationPayload: (
    type: string,
    payload: Record<string, unknown>
  ) => {
    const bookingId = payload.bookingId
    const startsAt = payload.startsAt
    const occurredAt = payload.occurredAt
    if (
      typeof bookingId !== "string" ||
      typeof startsAt !== "string" ||
      typeof occurredAt !== "string"
    ) {
      throw new Error("send-notification: booking payload is invalid")
    }
    if (
      type === "booking.rescheduled" &&
      (typeof payload.previousStartsAt !== "string" ||
        typeof payload.scheduleRevision !== "number")
    ) {
      throw new Error(
        "send-notification: reschedule payload missing previousStartsAt or scheduleRevision"
      )
    }
    return payload
  },
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

const { scheduleBookingReminders } = vi.hoisted(() => ({
  scheduleBookingReminders: vi.fn().mockResolvedValue({
    scheduled: [],
    skipped: [],
  }),
}))

vi.mock("../notifications/reminders", () => ({
  scheduleBookingReminders,
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
    scheduleBookingReminders.mockClear()
    const event = {
      id: "evt-2",
      type: "booking.confirmed" as const,
      orgId: "org-1",
      payload: {
        bookingId: "00000000-0000-4000-8000-000000000002",
        startsAt: "2026-09-22T15:00:00.000Z",
        occurredAt: "2026-09-21T14:00:00.000Z",
      },
    }
    await handleSendNotification(event)
    expect(sendBookingNotification).toHaveBeenCalledWith({
      id: "evt-2",
      type: "booking.confirmed",
      orgId: "org-1",
      payload: {
        bookingId: "00000000-0000-4000-8000-000000000002",
        startsAt: "2026-09-22T15:00:00.000Z",
        occurredAt: "2026-09-21T14:00:00.000Z",
      },
    })
    expect(scheduleBookingReminders).toHaveBeenCalledWith({
      bookingId: "00000000-0000-4000-8000-000000000002",
      orgId: "org-1",
      startsAt: new Date("2026-09-22T15:00:00.000Z"),
    })
    expect(scheduleBookingReminders.mock.invocationCallOrder[0]).toBeLessThan(
      sendBookingNotification.mock.invocationCallOrder[0] ??
        Number.MAX_SAFE_INTEGER
    )
    expect(sendClosedGateInvoiceNotification).not.toHaveBeenCalled()
    expect(sendPaymentPayoutNotification).not.toHaveBeenCalled()
  })

  it("schedules reminders for a reschedule before sending mail", async () => {
    sendBookingNotification.mockClear()
    scheduleBookingReminders.mockClear()
    await handleSendNotification({
      id: "evt-reschedule",
      type: "booking.rescheduled" as const,
      orgId: "org-1",
      payload: {
        bookingId: "00000000-0000-4000-8000-000000000002",
        startsAt: "2026-09-23T15:00:00.000Z",
        occurredAt: "2026-09-21T14:00:00.000Z",
        previousStartsAt: "2026-09-22T15:00:00.000Z",
        scheduleRevision: 1,
      },
    })
    expect(scheduleBookingReminders).toHaveBeenCalledWith({
      bookingId: "00000000-0000-4000-8000-000000000002",
      orgId: "org-1",
      startsAt: new Date("2026-09-23T15:00:00.000Z"),
    })
    expect(sendBookingNotification).toHaveBeenCalledTimes(1)
  })

  it("does not schedule reminders for cancelled bookings", async () => {
    sendBookingNotification.mockClear()
    scheduleBookingReminders.mockClear()
    await handleSendNotification({
      id: "evt-cancel",
      type: "booking.cancelled" as const,
      orgId: "org-1",
      payload: {
        bookingId: "00000000-0000-4000-8000-000000000002",
        startsAt: "2026-09-22T15:00:00.000Z",
        occurredAt: "2026-09-21T14:00:00.000Z",
      },
    })
    expect(sendBookingNotification).toHaveBeenCalledTimes(1)
    expect(scheduleBookingReminders).not.toHaveBeenCalled()
  })

  it("rejects a malformed reschedule before publishing reminder jobs", async () => {
    sendBookingNotification.mockClear()
    scheduleBookingReminders.mockClear()
    await expect(
      handleSendNotification({
        id: "evt-bad-reschedule",
        type: "booking.rescheduled" as const,
        orgId: "org-1",
        payload: {
          bookingId: "00000000-0000-4000-8000-000000000002",
          startsAt: "2026-09-23T15:00:00.000Z",
          occurredAt: "2026-09-21T14:00:00.000Z",
        },
      })
    ).rejects.toThrow(/previousStartsAt or scheduleRevision/)
    expect(scheduleBookingReminders).not.toHaveBeenCalled()
    expect(sendBookingNotification).not.toHaveBeenCalled()
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
