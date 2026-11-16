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
