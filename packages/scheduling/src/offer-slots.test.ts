import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  composeResolvedOffer,
  type OfferEventTypeRow,
  type OfferModeRow,
} from "./resolve-offer"
import { getAvailableSlotsForOffer } from "./offer-slots"

const mode: OfferModeRow = {
  id: "mode-1",
  orgId: "org-1",
  eventTypeId: "et-1",
  mode: "online",
  scheduleId: "sched-public",
  priceCents: 4500,
  durationMinutes: 30,
  countryScopeType: "worldwide",
  countryScopeCodes: [],
  languages: ["pt", "en"],
  active: true,
}

const eventType: OfferEventTypeRow = {
  id: "et-1",
  expertProfileId: "expert-1",
  durationMinutes: 60,
  priceAmount: 6000,
  published: true,
  bookingWindowDays: null,
  minimumNoticeMinutes: 0,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
}

const resolved = composeResolvedOffer({ orgId: "org-1", mode, eventType })
if (!resolved.ok) throw new Error("fixture")

describe("getAvailableSlotsForOffer", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date("2026-03-01T00:00:00Z"),
      toFake: ["Date"],
    })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  const morningRules = [
    { dayOfWeek: 0, startTime: "00:00:00", endTime: "04:00:00" },
    { dayOfWeek: 1, startTime: "09:00:00", endTime: "12:00:00" },
  ]

  it("uses the resolved mode duration, not the event-type duration", () => {
    const slots = getAvailableSlotsForOffer({
      offer: resolved.offer,
      schedule: { timezone: "UTC" },
      rules: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "10:30:00" }],
      overrides: [],
      existingBookings: [],
      from: new Date("2026-06-15T00:00:00Z"),
      to: new Date("2026-06-15T23:59:59Z"),
      minimumNoticeMinutes: 0,
      bookingWindowDays: null,
      bufferBeforeMinutes: 0,
    })
    expect(slots).toHaveLength(3)
    expect(slots[0]!.end.toISOString()).toBe("2026-06-15T09:30:00.000Z")
  })

  it("skips a DST spring-forward gap in Europe/Lisbon on 2026-03-29", () => {
    const slots = getAvailableSlotsForOffer({
      offer: resolved.offer,
      schedule: { timezone: "Europe/Lisbon" },
      rules: morningRules,
      overrides: [],
      existingBookings: [],
      from: new Date("2026-03-29T00:00:00Z"),
      to: new Date("2026-03-29T23:59:59Z"),
      minimumNoticeMinutes: 0,
      bookingWindowDays: null,
      bufferBeforeMinutes: 0,
    })
    const locals = slots.map((slot) => slot.startLocal)
    expect(locals[0]).toBe("2026-03-29T00:00:00")
    expect(locals.every((local) => !local.includes("T01:"))).toBe(true)
  })

  it("skips the ambiguous fall-back hour in Europe/Lisbon on 2026-10-25", () => {
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"))
    const slots = getAvailableSlotsForOffer({
      offer: resolved.offer,
      schedule: { timezone: "Europe/Lisbon" },
      rules: morningRules,
      overrides: [],
      existingBookings: [],
      from: new Date("2026-10-25T00:00:00Z"),
      to: new Date("2026-10-25T23:59:59Z"),
      minimumNoticeMinutes: 0,
      bookingWindowDays: null,
      bufferBeforeMinutes: 0,
    })
    const locals = slots.map((slot) => slot.startLocal)
    expect(locals.length).toBeGreaterThan(0)
    expect(new Set(locals).size).toBe(locals.length)
    expect(
      locals.filter((local) => local.startsWith("2026-10-25T01:")).length
    ).toBeLessThanOrEqual(2)
  })

  it("converts returned instants into the viewer timezone", () => {
    const slots = getAvailableSlotsForOffer({
      offer: resolved.offer,
      schedule: { timezone: "Europe/Lisbon" },
      rules: morningRules,
      overrides: [],
      existingBookings: [],
      from: new Date("2026-06-15T00:00:00Z"),
      to: new Date("2026-06-15T23:59:59Z"),
      viewerTz: "America/Sao_Paulo",
      minimumNoticeMinutes: 0,
      bookingWindowDays: null,
      bufferBeforeMinutes: 0,
    })
    expect(slots[0]!.start.toISOString()).toBe("2026-06-15T08:00:00.000Z")
    expect(slots[0]!.startLocal).toBe("2026-06-15T05:00:00")
  })

  it("lets a default 10-minute buffer hide the slot before a booking", () => {
    const slots = getAvailableSlotsForOffer({
      offer: resolved.offer,
      schedule: { timezone: "UTC" },
      rules: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "11:00:00" }],
      overrides: [],
      existingBookings: [
        {
          start: new Date("2026-06-15T08:45:00Z"),
          end: new Date("2026-06-15T08:55:00Z"),
        },
      ],
      from: new Date("2026-06-15T00:00:00Z"),
      to: new Date("2026-06-15T23:59:59Z"),
      minimumNoticeMinutes: 0,
      bookingWindowDays: null,
    })
    const starts = slots.map((slot) => slot.start.toISOString())
    expect(starts).not.toContain("2026-06-15T09:00:00.000Z")
    expect(starts).toContain("2026-06-15T09:30:00.000Z")
  })
})
