import { describe, expect, it } from "vitest"
import {
  bookingSelectionHref,
  parseBookingSelection,
  sameSlotInstant,
} from "./booking-selection"

const MODE_ID = "bfca9ce8-2314-47d8-9ad6-99a1f4347a99"
const START = "2026-10-13T08:00:00.000Z"

describe("parseBookingSelection", () => {
  it("reads mode and start from the booking URL", () => {
    expect(parseBookingSelection({ mode: MODE_ID, start: START })).toEqual({
      modeId: MODE_ID,
      start: START,
    })
  })

  it("rejects a missing or invalid mode id", () => {
    expect(parseBookingSelection({ start: START })).toBeNull()
    expect(
      parseBookingSelection({ mode: "not-a-uuid", start: START })
    ).toBeNull()
  })

  it("rejects a missing or invalid start instant", () => {
    expect(parseBookingSelection({ mode: MODE_ID })).toBeNull()
    expect(
      parseBookingSelection({ mode: MODE_ID, start: "tomorrow-morning" })
    ).toBeNull()
  })
})

describe("bookingSelectionHref", () => {
  it("builds a funnel URL with the selected slot", () => {
    const href = bookingSelectionHref("fisiomota", "first-visit", {
      modeId: MODE_ID,
      start: START,
    })
    expect(href.startsWith("/fisiomota/first-visit?")).toBe(true)
    const query = new URLSearchParams(href.split("?")[1])
    expect(query.get("mode")).toBe(MODE_ID)
    expect(query.get("start")).toBe(START)
  })
})

describe("sameSlotInstant", () => {
  it("treats equivalent ISO instants as the same slot", () => {
    expect(sameSlotInstant(START, "2026-10-13T08:00:00Z")).toBe(true)
    expect(sameSlotInstant(START, "2026-10-13T09:00:00.000Z")).toBe(false)
  })
})
