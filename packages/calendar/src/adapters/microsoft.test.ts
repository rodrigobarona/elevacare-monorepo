import { afterEach, describe, expect, it, vi } from "vitest"
import { MicrosoftCalendarAdapter } from "./microsoft"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Outlook session reminder", () => {
  const event = {
    calendarId: "cal-1",
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
          id: "evt-1",
          subject: "Session",
          start: { dateTime: "2026-12-01T10:00:00.0000000", timeZone: "UTC" },
          end: { dateTime: "2026-12-01T11:00:00.0000000", timeZone: "UTC" },
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
  }

  function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    return JSON.parse(init.body as string) as Record<string, unknown>
  }

  it("turns the reminder on at the chosen time", async () => {
    const fetchMock = stubCreate()
    await new MicrosoftCalendarAdapter().createEvent("token", {
      ...event,
      reminderMinutes: 30,
    })
    const body = sentBody(fetchMock)
    expect(body.isReminderOn).toBe(true)
    expect(body.reminderMinutesBeforeStart).toBe(30)
  })

  it("leaves Outlook's usual reminder alone when none is set", async () => {
    const fetchMock = stubCreate()
    await new MicrosoftCalendarAdapter().createEvent("token", event)
    const body = sentBody(fetchMock)
    expect(body).not.toHaveProperty("isReminderOn")
    expect(body).not.toHaveProperty("reminderMinutesBeforeStart")
  })
})
