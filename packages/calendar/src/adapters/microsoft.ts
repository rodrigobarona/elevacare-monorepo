import type {
  CalendarAdapter,
  CalendarEvent,
  CalendarEventInput,
  CalendarListItem,
  FreeBusyInterval,
} from "../types"

const GRAPH_API = "https://graph.microsoft.com/v1.0"

/**
 * Convert a UTC Date to the wall-clock time in the target timezone,
 * formatted as "YYYY-MM-DDTHH:mm:ss" for Microsoft Graph.
 */
function formatLocalDateTime(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? ""
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}`
}

export class MicrosoftCalendarAdapter implements CalendarAdapter {
  readonly provider = "microsoft" as const

  async listCalendars(accessToken: string): Promise<CalendarListItem[]> {
    const res = await fetch(`${GRAPH_API}/me/calendars`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Microsoft listCalendars: ${res.status}`)
    const data = (await res.json()) as {
      value: {
        id: string
        name: string
        isDefaultCalendar?: boolean
        canEdit: boolean
        owner?: { address: string; name?: string }
      }[]
    }
    return data.value.map((c) => ({
      id: c.id,
      name: c.name,
      primary: c.isDefaultCalendar ?? false,
      accessRole: c.canEdit ? "writer" : "reader",
      email: c.owner?.address,
    }))
  }

  async getFreeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date
  ): Promise<FreeBusyInterval[]> {
    const res = await fetch(`${GRAPH_API}/me/calendar/getSchedule`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schedules: calendarIds,
        startTime: {
          dateTime: timeMin.toISOString(),
          timeZone: "UTC",
        },
        endTime: {
          dateTime: timeMax.toISOString(),
          timeZone: "UTC",
        },
        availabilityViewInterval: 15,
      }),
    })
    if (!res.ok) throw new Error(`Microsoft getSchedule: ${res.status}`)
    const data = (await res.json()) as {
      value: {
        scheduleItems: {
          start: { dateTime: string }
          end: { dateTime: string }
          status: string
        }[]
      }[]
    }
    const intervals: FreeBusyInterval[] = []
    for (const schedule of data.value) {
      for (const item of schedule.scheduleItems) {
        if (item.status !== "free") {
          intervals.push({
            start: new Date(item.start.dateTime + "Z"),
            end: new Date(item.end.dateTime + "Z"),
          })
        }
      }
    }
    return intervals
  }

  async createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CalendarEvent> {
    const body = {
      subject: event.summary,
      body: event.description
        ? { contentType: "text", content: event.description }
        : undefined,
      start: {
        dateTime: formatLocalDateTime(event.startTime, event.timezone),
        timeZone: event.timezone,
      },
      end: {
        dateTime: formatLocalDateTime(event.endTime, event.timezone),
        timeZone: event.timezone,
      },
      attendees: event.attendees?.map((a) => ({
        emailAddress: { address: a.email, name: a.displayName },
        type: "required" as const,
      })),
      location: event.location ? { displayName: event.location } : undefined,
      transactionId: event.idempotencyId,
    }
    const res = await fetch(
      `${GRAPH_API}/me/calendars/${encodeURIComponent(event.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: 'IdType="ImmutableId"',
        },
        body: JSON.stringify(body),
      }
    )
    if (!res.ok) throw new Error(`Microsoft createEvent: ${res.status}`)
    return this.parseEvent(event.calendarId, await res.json())
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEventInput>
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {}
    if (event.summary) body.subject = event.summary
    if (event.description !== undefined)
      body.body = { contentType: "text", content: event.description }
    if (event.startTime && event.timezone)
      body.start = {
        dateTime: formatLocalDateTime(event.startTime, event.timezone),
        timeZone: event.timezone,
      }
    if (event.endTime && event.timezone)
      body.end = {
        dateTime: formatLocalDateTime(event.endTime, event.timezone),
        timeZone: event.timezone,
      }
    if (event.location !== undefined)
      body.location = { displayName: event.location }

    const res = await fetch(
      `${GRAPH_API}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )
    if (!res.ok) throw new Error(`Microsoft updateEvent: ${res.status}`)
    return this.parseEvent(calendarId, await res.json())
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const res = await fetch(
      `${GRAPH_API}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`Microsoft deleteEvent: ${res.status}`)
    }
  }

  private parseEvent(
    calendarId: string,
    raw: Record<string, unknown>
  ): CalendarEvent {
    const start = raw.start as { dateTime: string; timeZone: string }
    const end = raw.end as { dateTime: string; timeZone: string }
    return {
      id: raw.id as string,
      calendarId,
      summary: (raw.subject as string) ?? "",
      startTime: new Date(start.dateTime + "Z"),
      endTime: new Date(end.dateTime + "Z"),
      status: raw.isCancelled ? "cancelled" : "confirmed",
    }
  }
}
