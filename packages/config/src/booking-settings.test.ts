import { describe, expect, it } from "vitest"
import {
  APPROVAL_WINDOW_HOURS,
  BOOKING_SETTING_VALUES,
  describeBookingSetting,
  resolveApprovalDeadline,
} from "./booking-settings"

describe("describeBookingSetting", () => {
  it("has a name and at least two lines in every locale", () => {
    for (const locale of ["en", "pt", "es"] as const) {
      for (const setting of BOOKING_SETTING_VALUES) {
        const copy = describeBookingSetting(setting, locale)
        expect(copy.name.length).toBeGreaterThan(0)
        expect(copy.lines.length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe("resolveApprovalDeadline", () => {
  it("uses 24 hours when the session is further away", () => {
    const now = new Date("2026-10-13T10:00:00Z")
    const startsAt = new Date("2026-10-20T10:00:00Z")
    expect(resolveApprovalDeadline({ startsAt, now }).toISOString()).toBe(
      "2026-10-14T10:00:00.000Z"
    )
    expect(APPROVAL_WINDOW_HOURS).toBe(24)
  })

  it("uses the session start when that is sooner than 24 hours", () => {
    const now = new Date("2026-10-13T10:00:00Z")
    const startsAt = new Date("2026-10-13T14:00:00Z")
    expect(resolveApprovalDeadline({ startsAt, now }).toISOString()).toBe(
      startsAt.toISOString()
    )
  })
})
