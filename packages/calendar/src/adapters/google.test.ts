import { afterEach, describe, expect, it, vi } from "vitest"
import { CalendarAdapterError, CalendarTokenError } from "../errors"
import { GoogleCalendarAdapter } from "./google"

function googleError(status: number, reason: string) {
  return new Response(
    JSON.stringify({ error: { code: status, errors: [{ reason }] } }),
    { status, headers: { "content-type": "application/json" } }
  )
}

async function listWith(res: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res))
  return new GoogleCalendarAdapter().listCalendars("token")
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Google calendar errors", () => {
  it("reports a disabled Calendar API as a project problem, not a reconnect", async () => {
    const err = await listWith(googleError(403, "accessNotConfigured")).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(CalendarAdapterError)
    expect((err as CalendarAdapterError).code).toBe("403:accessNotConfigured")
  })

  it("reports a rate limit as a provider error", async () => {
    const err = await listWith(googleError(403, "rateLimitExceeded")).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(CalendarAdapterError)
  })

  it("asks for a reconnect when the grant is missing a scope", async () => {
    await expect(
      listWith(googleError(403, "insufficientPermissions"))
    ).rejects.toBeInstanceOf(CalendarTokenError)
  })

  it("asks for a reconnect on an expired or revoked token", async () => {
    await expect(
      listWith(new Response("", { status: 401 }))
    ).rejects.toBeInstanceOf(CalendarTokenError)
  })
})

describe("Google session reminder", () => {
  const event = {
    calendarId: "primary",
    summary: "Session",
    startTime: new Date("2026-12-01T10:00:00Z"),
    endTime: new Date("2026-12-01T11:00:00Z"),
    timezone: "Europe/Lisbon",
    idempotencyId: "0b6f3c1e-8a5b-4c2d-9e7f-1a2b3c4d5e6f",
  }

  function stubCreate() {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "0b6f3c1e8a5b4c2d9e7f1a2b3c4d5e6f",
          summary: "Session",
          start: { dateTime: "2026-12-01T10:00:00Z" },
          end: { dateTime: "2026-12-01T11:00:00Z" },
          status: "confirmed",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
  }

  function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    return JSON.parse(init.body as string) as Record<string, unknown>
  }

  it("sends a pop-up reminder when the expert chose one", async () => {
    const fetchMock = stubCreate()
    await new GoogleCalendarAdapter().createEvent("token", {
      ...event,
      reminderMinutes: 15,
    })
    expect(sentBody(fetchMock).reminders).toEqual({
      useDefault: false,
      overrides: [{ method: "popup", minutes: 15 }],
    })
  })

  it("keeps a reminder at the start time (0 minutes)", async () => {
    const fetchMock = stubCreate()
    await new GoogleCalendarAdapter().createEvent("token", {
      ...event,
      reminderMinutes: 0,
    })
    expect(sentBody(fetchMock).reminders).toEqual({
      useDefault: false,
      overrides: [{ method: "popup", minutes: 0 }],
    })
  })

  it("leaves the calendar's usual reminder alone when none is set", async () => {
    const fetchMock = stubCreate()
    await new GoogleCalendarAdapter().createEvent("token", {
      ...event,
      reminderMinutes: null,
    })
    expect(sentBody(fetchMock)).not.toHaveProperty("reminders")
  })
})
