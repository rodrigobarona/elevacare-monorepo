import { beforeEach, describe, expect, it, vi } from "vitest"

class CalendarTokenError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = "CalendarTokenError"
    this.code = code
  }
}

const googleBusy = vi.fn()
const microsoftBusy = vi.fn()
const getCalendarToken = vi.fn()
const markCalendarIntegrationExpired = vi.fn()
const listCalendarIntegrations = vi.fn()
const listBusySourcesForExpert = vi.fn()

vi.mock("@eleva/auth", () => ({
  getProviderAccessToken: vi.fn(),
  markCalendarIntegrationExpired,
}))
vi.mock("@eleva/calendar", () => ({
  CalendarTokenError,
  calendarProviderForSlug: (slug: string) =>
    ({ "google-calendar": "google", "microsoft-calendar": "microsoft" })[
      slug
    ] ?? null,
  createCredentialManager: () => ({ getCalendarToken }),
  getAdapter: (provider: string) => ({
    getFreeBusy: provider === "google" ? googleBusy : microsoftBusy,
  }),
  requireAuthAccountId: (id: string | null) => id ?? "missing",
}))
vi.mock("@eleva/db", () => ({
  listCalendarIntegrations,
  listBusySourcesForExpert,
}))
const redisGet = vi.fn()
const redisSet = vi.fn()
vi.mock("@/lib/booking-redis", () => ({
  getBookingRedis: () => ({ get: redisGet, set: redisSet }),
}))

const from = new Date("2026-10-01T00:00:00.000Z")
const to = new Date("2026-10-08T00:00:00.000Z")
const msConnectedAt = new Date("2026-09-01T00:00:00.000Z")
const input = {
  expertOrgId: "org-1",
  expertProfileId: "profile-1",
  expertUserId: "user-1",
  from,
  to,
}

describe("loadExternalBusy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCalendarToken.mockResolvedValue("token")
    redisGet.mockResolvedValue(null)
    redisSet.mockResolvedValue("OK")
    listCalendarIntegrations.mockResolvedValue([
      { id: "int-google", slug: "google-calendar", authAccountId: "acc-g" },
      {
        id: "int-ms",
        slug: "microsoft-calendar",
        authAccountId: "acc-m",
        connectedAt: msConnectedAt,
      },
      { id: "int-idle", slug: "google-calendar", authAccountId: "acc-i" },
    ])
    listBusySourcesForExpert.mockResolvedValue([
      {
        expertIntegrationId: "int-google",
        externalCalendarId: "primary",
        enabled: true,
      },
      {
        expertIntegrationId: "int-google",
        externalCalendarId: "work",
        enabled: false,
      },
      {
        expertIntegrationId: "int-ms",
        externalCalendarId: "ms-cal",
        enabled: true,
      },
      {
        expertIntegrationId: "int-idle",
        externalCalendarId: "off",
        enabled: false,
      },
    ])
  })

  it("merges enabled calendars and skips integrations with none enabled", async () => {
    const slotA = {
      start: new Date("2026-10-02T09:00:00.000Z"),
      end: new Date("2026-10-02T10:00:00.000Z"),
    }
    const slotB = {
      start: new Date("2026-10-03T09:00:00.000Z"),
      end: new Date("2026-10-03T10:00:00.000Z"),
    }
    googleBusy.mockResolvedValue([slotA])
    microsoftBusy.mockResolvedValue([slotB])
    const { loadExternalBusy } = await import("./calendar-busy")

    const result = await loadExternalBusy(input)

    expect(result).toEqual({ busy: [slotA, slotB], degradedSources: [] })
    expect(googleBusy).toHaveBeenCalledTimes(1)
    expect(googleBusy).toHaveBeenCalledWith("token", ["primary"], from, to)
    expect(microsoftBusy).toHaveBeenCalledWith("token", ["ms-cal"], from, to)
  })

  it("keeps other providers when one token is revoked and flags that integration", async () => {
    const slot = {
      start: new Date("2026-10-02T09:00:00.000Z"),
      end: new Date("2026-10-02T10:00:00.000Z"),
    }
    getCalendarToken.mockImplementation(
      async (_user: string, provider: string) => {
        if (provider === "microsoft") {
          throw new CalendarTokenError("needs_reauthorization")
        }
        return "token"
      }
    )
    googleBusy.mockResolvedValue([slot])
    const { loadExternalBusy } = await import("./calendar-busy")

    const result = await loadExternalBusy(input)

    expect(result).toEqual({ busy: [slot], degradedSources: ["int-ms"] })
    expect(markCalendarIntegrationExpired).toHaveBeenCalledWith({
      orgId: "org-1",
      integrationId: "int-ms",
      errorCode: "needs_reauthorization",
      observedConnectedAt: msConnectedAt,
    })
  })

  it("does not expire an integration for an ambiguous token failure", async () => {
    getCalendarToken.mockImplementation(
      async (_user: string, provider: string) => {
        if (provider === "microsoft") {
          throw new CalendarTokenError("token_unavailable")
        }
        return "token"
      }
    )
    googleBusy.mockResolvedValue([])
    const { loadExternalBusy } = await import("./calendar-busy")

    const result = await loadExternalBusy(input)

    expect(result.degradedSources).toEqual(["int-ms"])
    expect(markCalendarIntegrationExpired).not.toHaveBeenCalled()
  })

  it("drops a transient provider failure without flagging the integration", async () => {
    googleBusy.mockRejectedValue(new Error("503"))
    microsoftBusy.mockResolvedValue([])
    const { loadExternalBusy } = await import("./calendar-busy")

    const result = await loadExternalBusy(input)

    expect(result.degradedSources).toEqual(["int-google"])
    expect(markCalendarIntegrationExpired).not.toHaveBeenCalled()
  })
})

describe("busy time providers", () => {
  const cachedSlot = {
    start: "2026-10-02T09:00:00.000Z",
    end: "2026-10-02T10:00:00.000Z",
  }
  const liveSlot = {
    start: new Date("2026-10-02T11:00:00.000Z"),
    end: new Date("2026-10-02T12:00:00.000Z"),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getCalendarToken.mockResolvedValue("token")
    redisSet.mockResolvedValue("OK")
    listCalendarIntegrations.mockResolvedValue([
      { id: "int-google", slug: "google-calendar", authAccountId: "acc-g" },
    ])
    listBusySourcesForExpert.mockResolvedValue([
      {
        expertIntegrationId: "int-google",
        externalCalendarId: "primary",
        enabled: true,
      },
    ])
  })

  it("serves public slots from cache but rechecks live data for a hold", async () => {
    redisGet.mockResolvedValue([cachedSlot])
    googleBusy.mockResolvedValue([liveSlot])
    const { calendarBusyTimeProvider, holdCalendarBusyTimeProvider } =
      await import("./calendar-busy")

    const cached = await calendarBusyTimeProvider.getBusy(input)
    expect(cached).toEqual([
      { start: new Date(cachedSlot.start), end: new Date(cachedSlot.end) },
    ])
    expect(googleBusy).not.toHaveBeenCalled()

    const live = await holdCalendarBusyTimeProvider.getBusy(input)
    expect(live).toEqual([liveSlot])
    expect(googleBusy).toHaveBeenCalledTimes(1)
    expect(redisSet).toHaveBeenCalledTimes(1)
  })

  it("refuses a hold when a connected calendar could not be checked", async () => {
    redisGet.mockResolvedValue(null)
    googleBusy.mockRejectedValue(new Error("503"))
    const { holdCalendarBusyTimeProvider, CalendarBusyUnavailableError } =
      await import("./calendar-busy")

    await expect(
      holdCalendarBusyTimeProvider.getBusy(input)
    ).rejects.toBeInstanceOf(CalendarBusyUnavailableError)
  })
})
