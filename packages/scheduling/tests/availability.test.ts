import { describe, it, expect } from "vitest"
import { getAvailableSlots } from "../src/availability"

describe("getAvailableSlots", () => {
  const baseInput = {
    eventType: {
      durationMinutes: 60,
      bookingWindowDays: null,
      minimumNoticeMinutes: 0,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    },
    schedule: { timezone: "UTC" },
    rules: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "17:00:00" }],
    overrides: [],
    existingBookings: [],
    externalBusyTimes: [],
  }

  it("generates 60-min slots within a Monday availability window", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      rangeStart: new Date("2026-06-15T00:00:00Z"),
      rangeEnd: new Date("2026-06-15T23:59:59Z"),
    })

    expect(slots.length).toBe(8)
    expect(slots[0]!.start.toISOString()).toBe("2026-06-15T09:00:00.000Z")
    expect(slots[0]!.end.toISOString()).toBe("2026-06-15T10:00:00.000Z")
    expect(slots[7]!.start.toISOString()).toBe("2026-06-15T16:00:00.000Z")
  })

  it("returns no slots on days without rules", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      rangeStart: new Date("2026-06-14T00:00:00Z"),
      rangeEnd: new Date("2026-06-14T23:59:59Z"),
    })

    expect(slots).toHaveLength(0)
  })

  it("excludes slots that overlap with existing bookings", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      existingBookings: [
        {
          start: new Date("2026-06-15T10:00:00Z"),
          end: new Date("2026-06-15T11:00:00Z"),
        },
      ],
      rangeStart: new Date("2026-06-15T00:00:00Z"),
      rangeEnd: new Date("2026-06-15T23:59:59Z"),
    })

    expect(slots.length).toBe(7)
    const startTimes = slots.map((s) => s.start.toISOString())
    expect(startTimes).not.toContain("2026-06-15T10:00:00.000Z")
  })

  it("respects date overrides that block a day", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      overrides: [
        {
          overrideDate: "2026-06-15",
          startTime: null,
          endTime: null,
          isBlocked: true,
        },
      ],
      rangeStart: new Date("2026-06-15T00:00:00Z"),
      rangeEnd: new Date("2026-06-15T23:59:59Z"),
    })

    expect(slots).toHaveLength(0)
  })

  it("respects date overrides with custom hours", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      overrides: [
        {
          overrideDate: "2026-06-15",
          startTime: "10:00:00",
          endTime: "12:00:00",
          isBlocked: false,
        },
      ],
      rangeStart: new Date("2026-06-15T00:00:00Z"),
      rangeEnd: new Date("2026-06-15T23:59:59Z"),
    })

    expect(slots.length).toBe(2)
    expect(slots[0]!.start.toISOString()).toBe("2026-06-15T10:00:00.000Z")
    expect(slots[1]!.start.toISOString()).toBe("2026-06-15T11:00:00.000Z")
  })

  it("applies buffer times around slots", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      eventType: {
        ...baseInput.eventType,
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 15,
      },
      existingBookings: [
        {
          start: new Date("2026-06-15T11:00:00Z"),
          end: new Date("2026-06-15T12:00:00Z"),
        },
      ],
      rangeStart: new Date("2026-06-15T00:00:00Z"),
      rangeEnd: new Date("2026-06-15T23:59:59Z"),
    })

    const startTimes = slots.map((s) => s.start.toISOString())
    expect(startTimes).not.toContain("2026-06-15T10:00:00.000Z")
    expect(startTimes).not.toContain("2026-06-15T12:00:00.000Z")
  })

  it("handles timezone-aware availability (Europe/Lisbon summer = UTC+1)", () => {
    const slots = getAvailableSlots({
      ...baseInput,
      schedule: { timezone: "Europe/Lisbon" },
      rangeStart: new Date("2026-06-15T00:00:00Z"),
      rangeEnd: new Date("2026-06-15T23:59:59Z"),
    })

    expect(slots[0]!.start.toISOString()).toBe("2026-06-15T08:00:00.000Z")
    expect(slots[7]!.start.toISOString()).toBe("2026-06-15T15:00:00.000Z")
  })
})
