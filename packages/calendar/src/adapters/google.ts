import type {
  CalendarAdapter,
  CalendarEvent,
  CalendarEventInput,
  CalendarListItem,
  FreeBusyInterval,
} from "../types"
import {
  CalendarTokenError,
  CalendarAdapterError,
  CalendarNotFoundError,
  CalendarValidationError,
} from "../errors"

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const FETCH_TIMEOUT_MS = 10_000

async function throwGoogleError(
  operation: string,
  res: Response
): Promise<never> {
  if (res.status === 401 || res.status === 403) {
    throw new CalendarTokenError("needs_reauthorization")
  }
  let body: string
  try {
    body = await res.text()
  } catch {
    body = "(unreadable)"
  }
  if (res.status === 404) {
    throw new CalendarNotFoundError("google", operation, body)
  }
  throw new CalendarAdapterError({
    provider: "google",
    operation,
    message: `Google ${operation}: ${res.status} — ${body}`,
    statusCode: res.status,
  })
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = "google" as const

  async listCalendars(accessToken: string): Promise<CalendarListItem[]> {
    const items: {
      id: string
      summary: string
      primary?: boolean
      accessRole: string
    }[] = []
    let pageToken: string | undefined

    do {
      const url = new URL(`${GOOGLE_CALENDAR_API}/users/me/calendarList`)
      if (pageToken) url.searchParams.set("pageToken", pageToken)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) await throwGoogleError("listCalendars", res)

      const data = (await res.json()) as {
        items: {
          id: string
          summary: string
          primary?: boolean
          accessRole: string
        }[]
        nextPageToken?: string
      }
      items.push(...data.items)
      pageToken = data.nextPageToken
    } while (pageToken)

    return items.map((c) => ({
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
    const CHUNK_SIZE = 50
    const intervals: FreeBusyInterval[] = []

    for (let i = 0; i < calendarIds.length; i += CHUNK_SIZE) {
      const chunk = calendarIds.slice(i, i + CHUNK_SIZE)
      const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: chunk.map((id) => ({ id })),
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) await throwGoogleError("freeBusy", res)
      const data = (await res.json()) as {
        calendars: Record<
          string,
          {
            busy: { start: string; end: string }[]
            errors?: { domain: string; reason: string }[]
          }
        >
      }
      for (const [calId, cal] of Object.entries(data.calendars)) {
        if (cal.errors?.length) {
          throw new CalendarAdapterError({
            provider: "google",
            operation: "freeBusy",
            message: `freeBusy error for calendar ${calId}: ${JSON.stringify(cal.errors)}`,
          })
        }
        for (const b of cal.busy) {
          intervals.push({ start: new Date(b.start), end: new Date(b.end) })
        }
      }
    }

    return intervals
  }

  async createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CalendarEvent> {
    const eventId = event.idempotencyId.replace(/-/g, "").toLowerCase()
    if (!/^[0-9a-f]{32}$/.test(eventId)) {
      throw new CalendarValidationError(
        "google",
        "createEvent",
        `Invalid idempotencyId: must be a UUID (got "${event.idempotencyId}")`
      )
    }

    const body: Record<string, unknown> = {
      id: eventId,
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
    if (!res.ok) await throwGoogleError("createEvent", res)
    return this.parseEvent(event.calendarId, await res.json())
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEventInput>
  ): Promise<CalendarEvent> {
    if (
      (event.startTime && !event.endTime) ||
      (!event.startTime && event.endTime)
    ) {
      throw new CalendarValidationError(
        "google",
        "updateEvent",
        "requires both startTime and endTime, or neither"
      )
    }
    if (event.startTime && event.endTime && event.startTime >= event.endTime) {
      throw new CalendarValidationError(
        "google",
        "updateEvent",
        "startTime must be before endTime"
      )
    }

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
    if (!res.ok) await throwGoogleError("updateEvent", res)
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
      await throwGoogleError("deleteEvent", res)
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
    if (!res.ok) await throwGoogleError("getEvent", res)
    return this.parseEvent(calendarId, await res.json())
  }

  private parseEvent(
    calendarId: string,
    raw: Record<string, unknown>
  ): CalendarEvent {
    const start = raw.start as
      | { dateTime?: string; date?: string; timeZone?: string }
      | undefined
    const end = raw.end as
      | { dateTime?: string; date?: string; timeZone?: string }
      | undefined

    if (!start || !end) {
      throw new CalendarValidationError(
        "google",
        "parseEvent",
        `missing start/end in event ${raw.id}`
      )
    }

    let startTime: Date
    let endTime: Date

    if (start.dateTime) {
      startTime = new Date(start.dateTime)
    } else if (start.date) {
      startTime = new Date(`${start.date}T00:00:00`)
    } else {
      throw new CalendarValidationError(
        "google",
        "parseEvent",
        `no dateTime or date in start for event ${raw.id}`
      )
    }

    if (end.dateTime) {
      endTime = new Date(end.dateTime)
    } else if (end.date) {
      endTime = new Date(`${end.date}T00:00:00`)
    } else {
      throw new CalendarValidationError(
        "google",
        "parseEvent",
        `no dateTime or date in end for event ${raw.id}`
      )
    }

    return {
      id: raw.id as string,
      calendarId,
      summary: (raw.summary as string) ?? "",
      startTime,
      endTime,
      status: (raw.status as string) ?? "confirmed",
    }
  }
}
