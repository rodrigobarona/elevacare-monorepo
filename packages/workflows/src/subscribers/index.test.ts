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

import { defaultDomainEventSubscribers } from "./index"
import { handleSendNotification } from "./send-notification"

describe("defaultDomainEventSubscribers", () => {
  it("registers send-notification instead of a logging-only subscriber", async () => {
    const subscribers = defaultDomainEventSubscribers()
    expect(Object.keys(subscribers)).toEqual([
      "guest-activation",
      "send-notification",
      "calendar-sync",
    ])

    await subscribers["send-notification"]?.({
      id: "evt-1",
      type: "invoice.blocked",
      orgId: "org-1",
      payload: { invoiceId: "inv-1" },
    })
    expect(handleSendNotification).toHaveBeenCalledTimes(1)
  })
})
