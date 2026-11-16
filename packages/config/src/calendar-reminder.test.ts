import { describe, expect, it } from "vitest"
import {
  CALENDAR_REMINDER_MINUTES,
  isCalendarReminderMinutes,
} from "./calendar-reminder"

describe("calendar reminder minutes", () => {
  it("offers start time through one hour, in order", () => {
    expect(CALENDAR_REMINDER_MINUTES).toEqual([0, 5, 10, 15, 30, 60])
  })

  it("accepts only the offered values", () => {
    expect(isCalendarReminderMinutes(15)).toBe(true)
    expect(isCalendarReminderMinutes(0)).toBe(true)
    expect(isCalendarReminderMinutes(20)).toBe(false)
    expect(isCalendarReminderMinutes(null)).toBe(false)
    expect(isCalendarReminderMinutes("15")).toBe(false)
  })
})
