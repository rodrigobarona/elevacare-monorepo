import type {
  CalendarAdapter,
  CalendarEvent,
  CalendarEventInput,
  CalendarListItem,
  FreeBusyInterval,
} from "../types"

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const FETCH_TIMEOUT_MS = 10_000

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = "google" as const

  async listCalendars(accessToken: string): Promise<CalendarListItem[]> {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Google listCalendars: ${res.status}`)
    const data = (await res.json()) as {
      items: {
        id: string
        summary: string
        primary?: boolean
        accessRole: string
      }[]
    }
    return data.items.map((c) => ({
      id: c.id,
      name: c.summary,
      primary: c.primary ?? false,
      accessRole: c.accessRole,
    }))
  }

  async getFreeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date
  ): Promise<FreeBusyInterval[]> {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Google freeBusy: ${res.status}`)
    const data = (await res.json()) as {
      calendars: Record<string, { busy: { start: string; end: string }[] }>
    }
    const intervals: FreeBusyInterval[] = []
    for (const cal of Object.values(data.calendars)) {
      for (const b of cal.busy) {
        intervals.push({ start: new Date(b.start), end: new Date(b.end) })
      }
    }
    return intervals
  }

  async createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {
      id: event.idempotencyId.replace(/-/g, ""),
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone,
      },
      end: { dateTime: event.endTime.toISOString(), timeZone: event.timezone },
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
      })),
      location: event.location,
    }
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(event.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )
    if (res.status === 409) {
      const existing = await this.getEvent(
        accessToken,
        event.calendarId,
        body.id as string
      )
      return existing
    }
    if (!res.ok) throw new Error(`Google createEvent: ${res.status}`)
    return this.parseEvent(event.calendarId, await res.json())
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEventInput>
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {}
    if (event.summary !== undefined) body.summary = event.summary
    if (event.description !== undefined) body.description = event.description
    if (event.startTime)
      body.start = {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone,
      }
    if (event.endTime)
      body.end = {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone,
      }
    if (event.location !== undefined) body.location = event.location

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )
    if (!res.ok) throw new Error(`Google updateEvent: ${res.status}`)
    return this.parseEvent(calendarId, await res.json())
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )
    if (!res.ok && res.status !== 410) {
      throw new Error(`Google deleteEvent: ${res.status}`)
    }
  }

  private async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<CalendarEvent> {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )
    if (!res.ok) throw new Error(`Google getEvent: ${res.status}`)
    return this.parseEvent(calendarId, await res.json())
  }

  private parseEvent(
    calendarId: string,
    raw: Record<string, unknown>
  ): CalendarEvent {
    const start = raw.start as { dateTime?: string; date?: string }
    const end = raw.end as { dateTime?: string; date?: string }
    return {
      id: raw.id as string,
      calendarId,
      summary: (raw.summary as string) ?? "",
      startTime: new Date((start.dateTime ?? start.date)!),
      endTime: new Date((end.dateTime ?? end.date)!),
      status: (raw.status as string) ?? "confirmed",
    }
  }
}
