import { describe, expect, it } from "vitest"
import { shownBookingStatus } from "./shown-status"

const now = new Date("2026-11-11T12:00:00.000Z")
const past = "2026-11-04T10:00:00.000Z"
const future = "2026-11-20T10:00:00.000Z"

describe("shownBookingStatus", () => {
  it("shows a confirmed session whose time has passed as ended", () => {
    expect(shownBookingStatus("confirmed", past, { now })).toBe("ended")
    expect(shownBookingStatus("rescheduled", past, { now })).toBe("ended")
    expect(shownBookingStatus("confirmed", new Date(past), { now })).toBe(
      "ended"
    )
  })

  it("never says completed: nobody knows the two met", () => {
    expect(shownBookingStatus("confirmed", past, { now })).not.toBe("completed")
  })

  it("leaves a session still ahead, or still going on, as it is", () => {
    expect(shownBookingStatus("confirmed", future, { now })).toBe("confirmed")
    expect(shownBookingStatus("rescheduled", future, { now })).toBe(
      "rescheduled"
    )
    // It ends in one minute: not over yet.
    expect(
      shownBookingStatus("confirmed", "2026-11-11T12:01:00.000Z", { now })
    ).toBe("confirmed")
    // The booked end is the moment it counts as over.
    expect(shownBookingStatus("confirmed", now, { now })).toBe("ended")
  })

  it("waits for the grace time: an online session can still be joined", () => {
    const thirtyMinutes = 30 * 60_000
    const endedTenMinutesAgo = "2026-11-11T11:50:00.000Z"
    expect(
      shownBookingStatus("confirmed", endedTenMinutesAgo, {
        now,
        graceMs: thirtyMinutes,
      })
    ).toBe("confirmed")
    expect(
      shownBookingStatus("confirmed", "2026-11-11T11:30:00.000Z", {
        now,
        graceMs: thirtyMinutes,
      })
    ).toBe("ended")
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
      expect(shownBookingStatus(status, past, { now })).toBe(status)
      expect(shownBookingStatus(status, future, { now })).toBe(status)
    }
  })

  it("changes nothing when the end time cannot be read", () => {
    expect(shownBookingStatus("confirmed", "not a date", { now })).toBe(
      "confirmed"
    )
    expect(shownBookingStatus("confirmed", new Date("nope"), { now })).toBe(
      "confirmed"
    )
  })
})
