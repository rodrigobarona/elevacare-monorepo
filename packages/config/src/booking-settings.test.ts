import { describe, expect, it } from "vitest"
import {
  APPROVAL_WINDOW_HOURS,
  BOOKING_SETTING_VALUES,
  describeBookingSetting,
  resolveApprovalDeadline,
  slotRequiresApproval,
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

describe("slotRequiresApproval", () => {
  const now = new Date("2026-10-20T10:00:00.000Z")
  const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000)

  it("always asks when the offer is Request to book", () => {
    expect(
      slotRequiresApproval({
        requiresApproval: true,
        instantBookLeadMinutes: null,
        startsAt: at(72),
        now,
      })
    ).toBe(true)
  })

  it("is instant with no lead time", () => {
    expect(
      slotRequiresApproval({
        requiresApproval: false,
        instantBookLeadMinutes: null,
        startsAt: at(1),
        now,
      })
    ).toBe(false)
  })

  it("asks only inside the lead time", () => {
    const base = { requiresApproval: false, instantBookLeadMinutes: 1440, now }
    expect(slotRequiresApproval({ ...base, startsAt: at(23) })).toBe(true)
    expect(slotRequiresApproval({ ...base, startsAt: at(24) })).toBe(false)
    expect(slotRequiresApproval({ ...base, startsAt: at(48) })).toBe(false)
  })
})
