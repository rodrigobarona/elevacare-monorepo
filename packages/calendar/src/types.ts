export type CalendarProvider = "google" | "microsoft"

export interface CalendarListItem {
  id: string
  name: string
  primary: boolean
  accessRole: string
  /** SMTP email address of the calendar owner (Microsoft Graph owner.address). */
  email?: string
}

export interface FreeBusyInterval {
  start: Date
  end: Date
}

export interface CalendarEventInput {
  calendarId: string
  summary: string
  description?: string
  startTime: Date
  endTime: Date
  timezone: string
  attendees?: { email: string; displayName?: string }[]
  location?: string
  /**
   * Client-supplied ID for idempotent creation. The provider adapter
   * uses this as the event ID so retries produce a 409 conflict
   * instead of a duplicate event.
   */
  idempotencyId: string
}

export interface CalendarEvent {
  id: string
  calendarId: string
  summary: string
  startTime: Date
  endTime: Date
  status: string
}

/**
 * Calendar API adapter. Each provider (Google, Microsoft) implements
 * this interface for direct API calls. OAuth credential management is
 * handled by WorkOS Pipes -- see ADR-004 (amended 2026-05).
 */
export interface CalendarAdapter {
  readonly provider: CalendarProvider

  listCalendars(accessToken: string): Promise<CalendarListItem[]>
  getFreeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date
  ): Promise<FreeBusyInterval[]>

  createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CalendarEvent>
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEventInput>
  ): Promise<CalendarEvent>
  deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void>
}
