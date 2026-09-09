import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { CONSENT_DOCUMENT_VERSION, CONSENT_KINDS } from "@eleva/compliance"
import type { Redis } from "@upstash/redis"
import type { ResolvedOffer } from "./resolve-offer"
import type { ReserveSlotResult } from "./types"

const findExpertByUsername = vi.fn()
const getScheduleForBooking = vi.fn()
const listExpertBusyBookings = vi.fn()
const resolveOffer = vi.fn()
const reserveSlot = vi.fn()

vi.mock("@eleva/db", () => ({
  findExpertByUsername: (...args: unknown[]) => findExpertByUsername(...args),
  getScheduleForBooking: (...args: unknown[]) => getScheduleForBooking(...args),
  listExpertBusyBookings: (...args: unknown[]) =>
    listExpertBusyBookings(...args),
}))

vi.mock("./resolve-offer", async () => {
  const actual =
    await vi.importActual<typeof import("./resolve-offer")>("./resolve-offer")
  return {
    ...actual,
    resolveOffer: (...args: unknown[]) => resolveOffer(...args),
  }
})

vi.mock("./reserve-slot", async () => {
  const actual =
    await vi.importActual<typeof import("./reserve-slot")>("./reserve-slot")
  return {
    ...actual,
    reserveSlot: (...args: unknown[]) => reserveSlot(...args),
  }
})

const redis = {} as Redis

const offer: ResolvedOffer = {
  orgId: "org-1",
  eventTypeId: "et-1",
  eventTypeModeId: "mode-1",
  expertProfileId: "expert-1",
  mode: "online",
  scheduleId: "sched-1",
  priceCents: 4500,
  currency: "EUR",
  durationMinutes: 25,
  countryScopeType: "worldwide",
  countryScopeCodes: [],
  languages: ["pt", "en"],
  active: true,
  published: true,
  bookingWindowDays: null,
  minimumNoticeMinutes: 0,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
}

const grants = CONSENT_KINDS.map((kind) => ({
  kind,
  version: CONSENT_DOCUMENT_VERSION,
}))

const baseInput = {
  username: "ada",
  eventTypeModeId: "mode-1",
  startsAt: new Date("2026-09-10T10:00:00Z"),
  endsAt: new Date("2026-09-10T10:25:00Z"),
  timezone: "Europe/Lisbon",
  language: "pt",
  memberCountry: "PT",
  guest: { email: "member@eleva.care", name: "Ada" },
  consents: grants,
}

describe("reserveBooking", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date("2026-09-01T00:00:00Z"),
      toFake: ["Date"],
    })
    vi.clearAllMocks()
    findExpertByUsername.mockResolvedValue({
      id: "expert-1",
      userId: "expert-user-1",
      orgId: "org-1",
      username: "ada",
    })
    resolveOffer.mockResolvedValue({ ok: true, offer })
    getScheduleForBooking.mockResolvedValue({
      schedule: { id: "sched-1", timezone: "UTC" },
      rules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        startTime: "00:00:00",
        endTime: "23:59:00",
      })),
      overrides: [],
    })
    listExpertBusyBookings.mockResolvedValue([])
    reserveSlot.mockResolvedValue({
      success: true,
      reservationId: "res-1",
      reservationToken: "tok-1",
    } satisfies ReserveSlotResult)
  })

  it("rejects stale consents before resolving the offer or locking", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    const result = await reserveBooking(redis, {
      ...baseInput,
      consents: grants.map((grant) =>
        grant.kind === "terms" ? { ...grant, version: "stale" } : grant
      ),
    })
    expect(result).toEqual({
      ok: false,
      error: "CONSENT_VERSION_OUTDATED",
    })
    expect(findExpertByUsername).not.toHaveBeenCalled()
    expect(resolveOffer).not.toHaveBeenCalled()
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("rejects a country-gated mode before the slot lock", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    resolveOffer.mockResolvedValue({
      ok: true,
      offer: {
        ...offer,
        countryScopeType: "list",
        countryScopeCodes: ["PT"],
      },
    })
    const result = await reserveBooking(redis, {
      ...baseInput,
      memberCountry: "US",
    })
    expect(result).toEqual({
      ok: false,
      error: "MODE_NOT_AVAILABLE_IN_COUNTRY",
    })
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("requires an E.164 phone for phone mode", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    resolveOffer.mockResolvedValue({
      ok: true,
      offer: { ...offer, mode: "phone" },
    })
    const result = await reserveBooking(redis, baseInput)
    expect(result).toEqual({ ok: false, error: "PHONE_REQUIRED" })
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("accepts a session phone for phone mode", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    resolveOffer.mockResolvedValue({
      ok: true,
      offer: { ...offer, mode: "phone" },
    })
    const result = await reserveBooking(redis, {
      ...baseInput,
      guest: undefined,
      session: { userId: "user-1", email: "member@eleva.care" },
      phone: "+351912345678",
    })
    expect(result.ok).toBe(true)
    expect(reserveSlot).toHaveBeenCalled()
  })

  it("requires a guest or a session", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    const withoutGuest = {
      username: baseInput.username,
      eventTypeModeId: baseInput.eventTypeModeId,
      startsAt: baseInput.startsAt,
      endsAt: baseInput.endsAt,
      timezone: baseInput.timezone,
      language: baseInput.language,
      memberCountry: baseInput.memberCountry,
      consents: baseInput.consents,
    }
    const result = await reserveBooking(redis, withoutGuest)
    expect(result).toEqual({ ok: false, error: "GUEST_REQUIRED" })
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("maps a failed link claim to not_found", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    reserveSlot.mockResolvedValue({
      success: false,
      error: "link_unusable",
    } satisfies ReserveSlotResult)
    const result = await reserveBooking(redis, baseInput)
    expect(result).toEqual({ ok: false, error: "not_found" })
  })

  it("maps a Redis/DB slot conflict to SLOT_TAKEN", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    reserveSlot.mockResolvedValue({
      success: false,
      error: "conflict",
    } satisfies ReserveSlotResult)
    const result = await reserveBooking(redis, baseInput)
    expect(result).toEqual({ ok: false, error: "SLOT_TAKEN" })
  })

  it("rejects a duration that does not match the offer", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    const result = await reserveBooking(redis, {
      ...baseInput,
      endsAt: new Date("2026-09-10T11:00:00Z"),
    })
    expect(result).toEqual({ ok: false, error: "SLOT_UNAVAILABLE" })
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("rejects an unpublished public offer before the slot lock", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    resolveOffer.mockResolvedValue({
      ok: true,
      offer: { ...offer, published: false },
    })
    const result = await reserveBooking(redis, baseInput)
    expect(result).toEqual({ ok: false, error: "not_found" })
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("rejects a slot outside published availability", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    getScheduleForBooking.mockResolvedValue({
      schedule: { id: "sched-1", timezone: "UTC" },
      rules: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "10:00:00" }],
      overrides: [],
    })
    const result = await reserveBooking(redis, baseInput)
    expect(result).toEqual({ ok: false, error: "SLOT_UNAVAILABLE" })
    expect(reserveSlot).not.toHaveBeenCalled()
  })

  it("returns reservationId, reservationToken, and expiresAt", async () => {
    const { reserveBooking, RESERVE_TTL_SECONDS } =
      await import("./reserve-booking")
    const before = Date.now()
    const result = await reserveBooking(redis, baseInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reservationId).toBe("res-1")
    expect(result.reservationToken).toBe("tok-1")
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + RESERVE_TTL_SECONDS * 1000 - 50
    )
    expect(reserveSlot).toHaveBeenCalledWith(
      redis,
      expect.objectContaining({
        eventTypeId: "et-1",
        expertProfileId: "expert-1",
        price: { cents: 4500, currency: "EUR" },
        funnel: expect.objectContaining({
          timezone: "Europe/Lisbon",
          language: "pt",
          memberCountry: "PT",
          sessionMode: "online",
          guest: expect.objectContaining({
            email: "member@eleva.care",
            name: "Ada",
          }),
        }),
        audit: expect.objectContaining({
          payload: expect.objectContaining({
            language: "pt",
            memberCountry: "PT",
            consents: grants,
          }),
        }),
      })
    )
  })

  it("omits guest from the funnel snapshot when a session is present", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    const result = await reserveBooking(redis, {
      ...baseInput,
      guest: undefined,
      session: { userId: "user-1", email: "member@eleva.care" },
    })
    expect(result.ok).toBe(true)
    expect(reserveSlot).toHaveBeenCalledWith(
      redis,
      expect.objectContaining({
        userId: "user-1",
        funnel: {
          timezone: "Europe/Lisbon",
          language: "pt",
          memberCountry: "PT",
          bookingLinkId: null,
          sessionMode: "online",
        },
      })
    )
  })

  it("snapshots the top-level phone onto the guest funnel", async () => {
    const { reserveBooking } = await import("./reserve-booking")
    const result = await reserveBooking(redis, {
      ...baseInput,
      phone: "+351912345678",
    })
    expect(result.ok).toBe(true)
    expect(reserveSlot).toHaveBeenCalledWith(
      redis,
      expect.objectContaining({
        funnel: expect.objectContaining({
          guest: expect.objectContaining({
            email: "member@eleva.care",
            phone: "+351912345678",
          }),
        }),
      })
    )
  })
})

describe("isE164Phone", () => {
  it("accepts a country-prefixed number and rejects local formats", async () => {
    const { isE164Phone } = await import("./reserve-booking")
    expect(isE164Phone("+351912345678")).toBe(true)
    expect(isE164Phone("912345678")).toBe(false)
    expect(isE164Phone("+351 912 345 678")).toBe(false)
  })
})

afterAll(() => {
  vi.useRealTimers()
})
