export type CalendarProvider = "google" | "microsoft"

export interface CalendarListItem {
  id: string
  name: string
  primary: boolean
  accessRole: string
  /**
   * Eleva may write session events here: a Google calendar the person owns
   * (the `calendar.events.owned` scope) or a Microsoft calendar they can edit.
   */
  writable: boolean
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
   * Pop-up reminder this many minutes before the start, on the expert's own
   * event. Undefined or null: send nothing, so the calendar app's usual
   * reminder applies.
   */
  reminderMinutes?: number | null
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
 * handled by Eleva-owned OAuth via Better Auth -- see ADR-004.
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
