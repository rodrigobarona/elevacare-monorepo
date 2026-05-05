import { requireMicrosoftCalendarEnv } from "@eleva/config/env"
import type {
  CalendarAdapter,
  CalendarEvent,
  CalendarEventInput,
  CalendarListItem,
  FreeBusyInterval,
  OAuthStartResult,
  OAuthTokens,
} from "../types"

const MS_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token"
const GRAPH_API = "https://graph.microsoft.com/v1.0"

const DEFAULT_SCOPES = ["Calendars.ReadWrite", "offline_access"]

export class MicrosoftCalendarAdapter implements CalendarAdapter {
  readonly provider = "microsoft" as const

  startOAuth(scopes?: string[]): OAuthStartResult {
    const env = requireMicrosoftCalendarEnv()
    const state = crypto.randomUUID()
    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CALENDAR_CLIENT_ID,
      redirect_uri: env.MICROSOFT_CALENDAR_REDIRECT_URI,
      response_type: "code",
      scope: (scopes ?? DEFAULT_SCOPES).join(" "),
      state,
    })
    return {
      authorizationUrl: `${MS_AUTH_URL}?${params.toString()}`,
      state,
    }
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const env = requireMicrosoftCalendarEnv()
    const res = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.MICROSOFT_CALENDAR_CLIENT_ID,
        client_secret: env.MICROSOFT_CALENDAR_CLIENT_SECRET,
        redirect_uri: env.MICROSOFT_CALENDAR_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    })
    if (!res.ok) throw new Error(`Microsoft token exchange: ${res.status}`)
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
    const env = requireMicrosoftCalendarEnv()
    const res = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.MICROSOFT_CALENDAR_CLIENT_ID,
        client_secret: env.MICROSOFT_CALENDAR_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    })
    if (!res.ok) throw new Error(`Microsoft token refresh: ${res.status}`)
    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    }
  }

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
      }[]
    }
    return data.value.map((c) => ({
      id: c.id,
      name: c.name,
      primary: c.isDefaultCalendar ?? false,
      accessRole: c.canEdit ? "writer" : "reader",
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
        dateTime: event.startTime.toISOString().replace("Z", ""),
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.endTime.toISOString().replace("Z", ""),
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
    if (event.startTime)
      body.start = {
        dateTime: event.startTime.toISOString().replace("Z", ""),
        timeZone: event.timezone,
      }
    if (event.endTime)
      body.end = {
        dateTime: event.endTime.toISOString().replace("Z", ""),
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
