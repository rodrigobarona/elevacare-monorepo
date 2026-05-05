import { requireGoogleCalendarEnv } from "@eleva/config/env"
import type {
  CalendarAdapter,
  CalendarEvent,
  CalendarEventInput,
  CalendarListItem,
  FreeBusyInterval,
  OAuthStartResult,
  OAuthTokens,
} from "../types"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
]

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = "google" as const

  startOAuth(scopes?: string[]): OAuthStartResult {
    const env = requireGoogleCalendarEnv()
    const state = crypto.randomUUID()
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      redirect_uri: env.GOOGLE_CALENDAR_REDIRECT_URI,
      response_type: "code",
      scope: (scopes ?? DEFAULT_SCOPES).join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    })
    return {
      authorizationUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
      state,
    }
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const env = requireGoogleCalendarEnv()
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALENDAR_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    })
    if (!res.ok) {
      throw new Error(`Google token exchange failed: ${res.status}`)
    }
    const data = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      scope: string
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const env = requireGoogleCalendarEnv()
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    })
    if (!res.ok) {
      throw new Error(`Google token refresh failed: ${res.status}`)
    }
    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      scope: string
    }
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    }
  }

  async listCalendars(accessToken: string): Promise<CalendarListItem[]> {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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
    if (event.summary) body.summary = event.summary
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
      { headers: { Authorization: `Bearer ${accessToken}` } }
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
