import { describe, expect, it } from "vitest"
import { quietHoursSilence } from "./channels"
import { isWithinQuietHours, quietHoursFrom } from "./quiet-hours"

const at = (iso: string) => new Date(iso)

describe("isWithinQuietHours", () => {
  it("handles a same-day window", () => {
    const quiet = { start: "13:00", end: "15:00", timezone: "UTC" }
    expect(isWithinQuietHours(quiet, at("2026-01-10T12:59:00Z"))).toBe(false)
    expect(isWithinQuietHours(quiet, at("2026-01-10T13:00:00Z"))).toBe(true)
    expect(isWithinQuietHours(quiet, at("2026-01-10T15:00:00Z"))).toBe(false)
  })

  it("wraps midnight", () => {
    const quiet = { start: "22:00:00", end: "08:00:00", timezone: "UTC" }
    expect(isWithinQuietHours(quiet, at("2026-01-10T23:30:00Z"))).toBe(true)
    expect(isWithinQuietHours(quiet, at("2026-01-10T07:59:00Z"))).toBe(true)
    expect(isWithinQuietHours(quiet, at("2026-01-10T08:00:00Z"))).toBe(false)
    expect(isWithinQuietHours(quiet, at("2026-01-10T12:00:00Z"))).toBe(false)
  })

  it("evaluates in the member timezone, including DST", () => {
    const quiet = { start: "22:00", end: "08:00", timezone: "Europe/Lisbon" }
    // 21:30 UTC is 22:30 in Lisbon summer time, 21:30 in winter.
    expect(isWithinQuietHours(quiet, at("2026-07-10T21:30:00Z"))).toBe(true)
    expect(isWithinQuietHours(quiet, at("2026-01-10T21:30:00Z"))).toBe(false)
  })

  it("treats an empty or malformed window as no quiet hours", () => {
    const now = at("2026-01-10T10:00:00Z")
    expect(
      isWithinQuietHours({ start: "10:00", end: "10:00", timezone: null }, now)
    ).toBe(false)
    expect(
      isWithinQuietHours({ start: "nope", end: "11:00", timezone: null }, now)
    ).toBe(false)
  })

  it("falls back to UTC for an invalid timezone", () => {
    const quiet = { start: "09:00", end: "11:00", timezone: "Mars/Olympus" }
    expect(isWithinQuietHours(quiet, at("2026-01-10T10:00:00Z"))).toBe(true)
  })
})

describe("quietHoursSilence", () => {
  const preferences = [
    {
      channel: "email" as const,
      category: "booking" as const,
      enabled: true,
      quietHoursStart: "00:00",
      quietHoursEnd: "23:59",
      timezone: "UTC",
    },
  ]
  const now = at("2026-01-10T12:00:00Z")

  it("silences non-urgent SMS only", () => {
    expect(
      quietHoursSilence({
        kind: "booking.confirmed",
        channel: "sms",
        preferences,
        now,
      })
    ).toBe(true)
    expect(
      quietHoursSilence({
        kind: "booking.confirmed",
        channel: "email",
        preferences,
        now,
      })
    ).toBe(false)
    expect(
      quietHoursSilence({
        kind: "booking.reminder_1h",
        channel: "sms",
        preferences,
        now,
      })
    ).toBe(false)
  })

  it("does nothing without stored quiet hours", () => {
    expect(quietHoursFrom([{ quietHoursStart: null }])).toBeNull()
    expect(
      quietHoursSilence({
        kind: "booking.confirmed",
        channel: "sms",
        preferences: [],
        now,
      })
    ).toBe(false)
  })
})
