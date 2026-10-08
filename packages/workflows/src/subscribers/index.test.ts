import { describe, expect, it, vi } from "vitest"

vi.mock("./guest-activation", () => ({
  activateGuestBooking: vi.fn(),
}))

vi.mock("./send-notification", () => ({
  handleSendNotification: vi.fn(),
}))

vi.mock("./calendar-sync", () => ({
  handleCalendarSync: vi.fn(),
}))

vi.mock("../video/ensure-session-room", () => ({
  cancelUnstartedSessionRoom: vi.fn(),
  deleteSessionRoom: vi.fn(),
  ensureSessionRoom: vi.fn(),
}))

import { defaultDomainEventSubscribers } from "./index"
import { handleSendNotification } from "./send-notification"
import {
  cancelUnstartedSessionRoom,
  deleteSessionRoom,
  ensureSessionRoom,
} from "../video/ensure-session-room"

describe("defaultDomainEventSubscribers", () => {
  it("registers send-notification instead of a logging-only subscriber", async () => {
    const subscribers = defaultDomainEventSubscribers()
    expect(Object.keys(subscribers)).toEqual([
      "guest-activation",
      "send-notification",
      "calendar-sync",
      "ensure-session-room",
    ])

    await subscribers["send-notification"]?.({
      id: "evt-1",
      type: "invoice.blocked",
      orgId: "org-1",
      payload: { invoiceId: "inv-1" },
    })
    expect(handleSendNotification).toHaveBeenCalledTimes(1)
  })

  it("creates a room on confirm and deletes it on cancel", async () => {
    const subscribers = defaultDomainEventSubscribers()
    await subscribers["ensure-session-room"]?.({
      id: "evt-2",
      type: "booking.confirmed",
      orgId: "org-1",
      payload: { bookingId: "bk-1" },
    })
    expect(ensureSessionRoom).toHaveBeenCalledWith("bk-1")
    expect(deleteSessionRoom).not.toHaveBeenCalled()

    await subscribers["ensure-session-room"]?.({
      id: "evt-3",
      type: "booking.cancelled",
      orgId: "org-1",
      payload: { bookingId: "bk-1" },
    })
    expect(deleteSessionRoom).toHaveBeenCalledWith("bk-1")
  })

  it("cancels an unstarted room on payment.failed and refund.succeeded", async () => {
    vi.mocked(ensureSessionRoom).mockClear()
    vi.mocked(deleteSessionRoom).mockClear()
    vi.mocked(cancelUnstartedSessionRoom).mockClear()
    const subscribers = defaultDomainEventSubscribers()
    await subscribers["ensure-session-room"]?.({
      id: "evt-4",
      type: "payment.failed",
      orgId: "org-1",
      payload: { bookingId: "bk-2", occurredAt: "2026-10-08T10:00:00.000Z" },
    })
    expect(cancelUnstartedSessionRoom).toHaveBeenCalledWith(
      "bk-2",
      {},
      new Date("2026-10-08T10:00:00.000Z")
    )
    expect(ensureSessionRoom).not.toHaveBeenCalled()

    await subscribers["ensure-session-room"]?.({
      id: "evt-5",
      type: "refund.succeeded",
      orgId: "org-1",
      payload: {
        bookingId: "bk-2",
        occurredAt: "2026-10-08T10:00:00.000Z",
        cancelsSession: true,
      },
    })
    expect(cancelUnstartedSessionRoom).toHaveBeenCalledTimes(2)

    await subscribers["ensure-session-room"]?.({
      id: "evt-6",
      type: "refund.succeeded",
      orgId: "org-1",
      payload: {
        bookingId: "bk-2",
        occurredAt: "2026-10-08T10:00:00.000Z",
        cancelsSession: false,
      },
    })
    expect(cancelUnstartedSessionRoom).toHaveBeenCalledTimes(2)
  })

  it("fails when payment.failed is missing occurredAt", async () => {
    const subscribers = defaultDomainEventSubscribers()
    await expect(
      subscribers["ensure-session-room"]?.({
        id: "evt-7",
        type: "payment.failed",
        orgId: "org-1",
        payload: { bookingId: "bk-2" },
      })
    ).rejects.toThrow(/occurredAt/)
  })
})
