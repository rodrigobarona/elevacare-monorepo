import { describe, it, expect } from "vitest"
import {
  validateBookingRules,
  canCancel,
  canReschedule,
} from "../src/booking-rules"

describe("validateBookingRules", () => {
  const now = new Date("2026-06-15T10:00:00Z")

  it("rejects past slots", () => {
    const result = validateBookingRules({
      eventType: {
        bookingWindowDays: null,
        minimumNoticeMinutes: 0,
        cancellationWindowHours: null,
        rescheduleWindowHours: null,
      },
      slotStart: new Date("2026-06-15T09:00:00Z"),
      now,
    })

    expect(result).toBe("past_slot")
  })

  it("rejects insufficient notice", () => {
    const result = validateBookingRules({
      eventType: {
        bookingWindowDays: null,
        minimumNoticeMinutes: 120,
        cancellationWindowHours: null,
        rescheduleWindowHours: null,
      },
      slotStart: new Date("2026-06-15T11:00:00Z"),
      now,
    })

    expect(result).toBe("insufficient_notice")
  })

  it("rejects outside booking window", () => {
    const result = validateBookingRules({
      eventType: {
        bookingWindowDays: 7,
        minimumNoticeMinutes: 0,
        cancellationWindowHours: null,
        rescheduleWindowHours: null,
      },
      slotStart: new Date("2026-06-30T10:00:00Z"),
      now,
    })

    expect(result).toBe("outside_booking_window")
  })

  it("accepts valid slots", () => {
    const result = validateBookingRules({
      eventType: {
        bookingWindowDays: 30,
        minimumNoticeMinutes: 60,
        cancellationWindowHours: null,
        rescheduleWindowHours: null,
      },
      slotStart: new Date("2026-06-16T10:00:00Z"),
      now,
    })

    expect(result).toBeNull()
  })
})

describe("canCancel", () => {
  it("allows cancellation when no window is set", () => {
    expect(canCancel(null, new Date("2026-06-15T12:00:00Z"))).toBe(true)
  })

  it("allows cancellation within window", () => {
    const now = new Date("2026-06-15T10:00:00Z")
    const startsAt = new Date("2026-06-16T10:00:00Z")
    expect(canCancel(12, startsAt, now)).toBe(true)
  })

  it("blocks cancellation outside window", () => {
    const now = new Date("2026-06-15T10:00:00Z")
    const startsAt = new Date("2026-06-15T14:00:00Z")
    expect(canCancel(12, startsAt, now)).toBe(false)
  })
})

describe("canReschedule", () => {
  it("allows reschedule when no window is set", () => {
    expect(canReschedule(null, new Date("2026-06-15T12:00:00Z"))).toBe(true)
  })

  it("allows reschedule within window", () => {
    const now = new Date("2026-06-15T10:00:00Z")
    const startsAt = new Date("2026-06-17T10:00:00Z")
    expect(canReschedule(24, startsAt, now)).toBe(true)
  })

  it("blocks reschedule outside window", () => {
    const now = new Date("2026-06-15T10:00:00Z")
    const startsAt = new Date("2026-06-15T18:00:00Z")
    expect(canReschedule(24, startsAt, now)).toBe(false)
  })
})
