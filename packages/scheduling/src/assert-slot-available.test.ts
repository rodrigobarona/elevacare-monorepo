import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { assertRequestedSlotAvailable } from "./assert-slot-available"
import {
  composeResolvedOffer,
  type OfferEventTypeRow,
  type OfferModeRow,
} from "./resolve-offer"

const mode: OfferModeRow = {
  id: "mode-1",
  orgId: "org-1",
  eventTypeId: "et-1",
  mode: "online",
  scheduleId: "sched-1",
  priceCents: 6000,
  durationMinutes: 30,
  countryScopeType: "worldwide",
  countryScopeCodes: [],
  languages: ["pt"],
  active: true,
}

const eventType: OfferEventTypeRow = {
  id: "et-1",
  expertProfileId: "expert-1",
  durationMinutes: 30,
  priceAmount: 6000,
  published: true,
  bookingWindowDays: null,
  minimumNoticeMinutes: 0,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  cancellationPolicy: "flexible",
}

const resolved = composeResolvedOffer({ orgId: "org-1", mode, eventType })
if (!resolved.ok) throw new Error("fixture")

const base = {
  offer: resolved.offer,
  startsAt: new Date("2026-06-15T09:00:00Z"),
  endsAt: new Date("2026-06-15T09:30:00Z"),
  schedule: { timezone: "UTC" },
  rules: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "12:00:00" }],
  overrides: [],
  existingBookings: [],
  now: new Date("2026-06-01T00:00:00Z"),
}

describe("assertRequestedSlotAvailable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: base.now, toFake: ["Date"] })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it("accepts a free slot on the schedule grid", () => {
    expect(assertRequestedSlotAvailable(base)).toEqual({ ok: true })
  })

  it("rejects a slot that overlaps the expert's external calendar", () => {
    expect(
      assertRequestedSlotAvailable({
        ...base,
        externalBusyTimes: [
          {
            start: new Date("2026-06-15T09:15:00Z"),
            end: new Date("2026-06-15T09:45:00Z"),
          },
        ],
      })
    ).toEqual({ ok: false, error: "SLOT_UNAVAILABLE" })
  })
})
