import { describe, expect, it } from "vitest"
import { shownBookingStatus } from "./shown-status"

const now = new Date("2026-11-11T12:00:00.000Z")
const past = "2026-11-04T10:00:00.000Z"
const future = "2026-11-20T10:00:00.000Z"

describe("shownBookingStatus", () => {
  it("shows a confirmed session whose time has passed as completed", () => {
    expect(shownBookingStatus("confirmed", past, now)).toBe("completed")
    expect(shownBookingStatus("rescheduled", past, now)).toBe("completed")
    expect(shownBookingStatus("confirmed", new Date(past), now)).toBe(
      "completed"
    )
  })

  it("leaves a session still ahead, or still going on, as it is", () => {
    expect(shownBookingStatus("confirmed", future, now)).toBe("confirmed")
    expect(shownBookingStatus("rescheduled", future, now)).toBe("rescheduled")
    // It ends in one minute: not over yet.
    expect(
      shownBookingStatus("confirmed", "2026-11-11T12:01:00.000Z", now)
    ).toBe("confirmed")
    // The booked end is the moment it counts as over.
    expect(shownBookingStatus("confirmed", now, now)).toBe("completed")
  })

  it("never changes any other status, past or not", () => {
    for (const status of [
      "cancelled",
      "awaiting_confirmation",
      "pending_payment",
      "completed",
      "no_show",
      "refunded",
    ]) {
      expect(shownBookingStatus(status, past, now)).toBe(status)
      expect(shownBookingStatus(status, future, now)).toBe(status)
    }
  })

  it("changes nothing when the end time cannot be read", () => {
    expect(shownBookingStatus("confirmed", "not a date", now)).toBe("confirmed")
  })
})
