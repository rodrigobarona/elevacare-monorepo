import { describe, expect, it } from "vitest"

import { formatSlotDateTime } from "./format-slot-time"

describe("formatSlotDateTime", () => {
  it("does not throw when showing a zone name", () => {
    expect(() =>
      formatSlotDateTime("2026-09-10T09:00:00.000Z", "en", "Europe/Lisbon")
    ).not.toThrow()
  })

  it("includes the Lisbon wall time and a zone label", () => {
    const label = formatSlotDateTime(
      "2026-09-10T09:00:00.000Z",
      "en",
      "Europe/Lisbon"
    )
    expect(label).toMatch(/10:00/)
    expect(label).toMatch(/WEST|GMT/i)
  })
})
