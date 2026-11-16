import { beforeEach, describe, expect, it, vi } from "vitest"

const requireApiCapability = vi.fn()
const getExpertProfileForOrg = vi.fn()
const getDestinationCalendar = vi.fn()
const setCalendarReminder = vi.fn()
const emit = vi.fn()

vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: (...args: unknown[]) =>
    getExpertProfileForOrg(...args),
  getDestinationCalendar: (...args: unknown[]) =>
    getDestinationCalendar(...args),
  setCalendarReminder: (...args: unknown[]) => setCalendarReminder(...args),
}))

vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _options: unknown,
    fn: (tx: unknown, ctx: { emit: typeof emit }) => Promise<unknown>
  ) => fn("tx", { emit }),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: (...args: unknown[]) => requireApiCapability(...args),
  apiAuthFailure: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
  ),
}))

vi.mock("@eleva/observability", () => ({ logError: vi.fn() }))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "reminder",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { GET, PUT } from "./route"

const URL = "http://127.0.0.1:3002/expert/calendar/reminder"

function put(body: unknown) {
  return PUT(
    new Request(URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("/expert/calendar/reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireApiCapability.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "practice-org",
    })
    getExpertProfileForOrg.mockResolvedValue({
      id: "profile-1",
      orgId: "practice-org",
    })
    setCalendarReminder.mockResolvedValue(true)
  })

  it("reads the reminder with whether a destination exists", async () => {
    getDestinationCalendar.mockResolvedValue({
      expertIntegrationId: "int-1",
      externalCalendarId: "primary",
      displayName: "Main",
      reminderMinutes: 15,
    })
    const response = await GET(new Request(URL))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      reminderMinutes: 15,
      hasDestination: true,
    })
  })

  it("reads the calendar's usual reminder when nothing is set up", async () => {
    getDestinationCalendar.mockResolvedValue(null)
    const response = await GET(new Request(URL))
    expect(await response.json()).toEqual({
      reminderMinutes: null,
      hasDestination: false,
    })
  })

  it("saves an offered reminder and audits it", async () => {
    const response = await put({ reminderMinutes: 30 })
    expect(response.status).toBe(200)
    expect(setCalendarReminder).toHaveBeenCalledWith(
      "practice-org",
      "profile-1",
      30,
      "tx"
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "expert_profile",
        action: "updated",
        entityId: "profile-1",
        payload: {
          field: "calendar_reminder_minutes",
          reminderMinutes: 30,
        },
      })
    )
  })

  it("goes back to the calendar's usual reminder with null", async () => {
    const response = await put({ reminderMinutes: null })
    expect(response.status).toBe(200)
    expect(setCalendarReminder).toHaveBeenCalledWith(
      "practice-org",
      "profile-1",
      null,
      "tx"
    )
  })

  it("rejects a time Eleva does not offer", async () => {
    const response = await put({ reminderMinutes: 20 })
    expect(response.status).toBe(422)
    expect(setCalendarReminder).not.toHaveBeenCalled()
  })

  it("rejects a missing value", async () => {
    const response = await put({})
    expect(response.status).toBe(422)
  })

  it("asks for a destination first", async () => {
    setCalendarReminder.mockResolvedValue(false)
    const response = await put({ reminderMinutes: 10 })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("destination_required")
    expect(emit).not.toHaveBeenCalled()
  })

  it("refuses an unsigned caller", async () => {
    requireApiCapability.mockRejectedValue(new Error("unauthorized"))
    const response = await put({ reminderMinutes: 10 })
    expect(response.status).toBe(401)
    expect(setCalendarReminder).not.toHaveBeenCalled()
  })

  it("answers 404 without an expert profile", async () => {
    getExpertProfileForOrg.mockResolvedValue(null)
    const response = await put({ reminderMinutes: 10 })
    expect(response.status).toBe(404)
  })
})
