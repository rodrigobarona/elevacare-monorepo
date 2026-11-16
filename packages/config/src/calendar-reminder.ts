/**
 * The reminder Eleva puts on a session it adds to an expert's own calendar
 * (Google or Outlook). `null` means "use the calendar's usual reminder":
 * Eleva sends no reminder settings and the calendar app decides.
 *
 * Members are reminded by Eleva's own emails, so this only affects the
 * expert's calendar event.
 */
export const CALENDAR_REMINDER_MINUTES = [0, 5, 10, 15, 30, 60] as const

export type CalendarReminderMinutes = (typeof CALENDAR_REMINDER_MINUTES)[number]

export function isCalendarReminderMinutes(
  value: unknown
): value is CalendarReminderMinutes {
  return (
    typeof value === "number" &&
    (CALENDAR_REMINDER_MINUTES as readonly number[]).includes(value)
  )
}
