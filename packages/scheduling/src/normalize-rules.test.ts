import { describe, expect, it } from "vitest"

import { normalizeAvailabilityRules } from "./normalize-rules"

describe("normalizeAvailabilityRules", () => {
  it("merges overlapping ranges on the same weekday", () => {
    const result = normalizeAvailabilityRules([
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "11:00", endTime: "14:00" },
      { dayOfWeek: 2, startTime: "10:00", endTime: "11:00" },
    ])
    expect(result).toEqual({
      ok: true,
      rules: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "14:00" },
        { dayOfWeek: 2, startTime: "10:00", endTime: "11:00" },
      ],
    })
  })

  it("merges contiguous ranges", () => {
    const result = normalizeAvailabilityRules([
      { dayOfWeek: 3, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 3, startTime: "12:00", endTime: "17:00" },
    ])
    expect(result).toEqual({
      ok: true,
      rules: [{ dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }],
    })
  })

  it("rejects cross-midnight ranges", () => {
    const result = normalizeAvailabilityRules([
      { dayOfWeek: 5, startTime: "22:00", endTime: "02:00" },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("CROSS_MIDNIGHT")
    }
  })

  it("rejects invalid dayOfWeek", () => {
    const result = normalizeAvailabilityRules([
      { dayOfWeek: 7, startTime: "09:00", endTime: "10:00" },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("INVALID_DAY")
    }
  })
})
