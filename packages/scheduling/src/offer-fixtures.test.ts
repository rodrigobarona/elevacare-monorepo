import {
  OFFER_FIXTURE_DAY_END,
  OFFER_FIXTURE_DAY_START,
  OFFER_FIXTURE_WEEKDAYS,
  PHYSIOTHERAPY_FIXTURE,
  QUICK_CHAT_FIXTURE,
  type OfferFixture,
  type OfferFixtureEventType,
  type OfferFixtureMode,
} from "@eleva/db/seed/offer-fixture-specs"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { assertModeBookable } from "./mode-bookable"
import { assertOfferInvariants } from "./offer-invariants"
import { getAvailableSlotsForOffer } from "./offer-slots"
import { composeResolvedOffer, type ResolvedOffer } from "./resolve-offer"

function eventType(fixture: OfferFixture, slug: string): OfferFixtureEventType {
  const found = fixture.eventTypes.find((candidate) => candidate.slug === slug)
  if (!found) throw new Error(`missing fixture event type ${slug}`)
  return found
}

function visibleModes(
  modes: OfferFixtureMode[],
  memberCountry: string,
  language: string
): OfferFixtureMode["mode"][] {
  return modes
    .filter(
      (mode) =>
        assertModeBookable({
          active: true,
          countryScopeType: mode.countryScopeType,
          countryScopeCodes: mode.countryScopeCodes,
          languages: mode.languages,
          memberCountry,
          language,
        }).ok
    )
    .map((mode) => mode.mode)
}

function invariantFor(
  fixture: OfferFixture,
  type: OfferFixtureEventType,
  mode: OfferFixtureMode
) {
  const location = fixture.locations.find((l) => l.name === mode.location)
  return assertOfferInvariants({
    kind: type.kind,
    worldwideRemote: fixture.profile.worldwideRemote,
    serviceCountries: fixture.profile.serviceCountries,
    profileLanguages: fixture.profile.languages,
    mode: mode.mode,
    countryScopeType: mode.countryScopeType,
    countryScopeCodes: mode.countryScopeCodes,
    languages: mode.languages,
    locationCountry: location?.country ?? null,
  })
}

function resolve(
  type: OfferFixtureEventType,
  mode: OfferFixtureMode
): ResolvedOffer {
  const result = composeResolvedOffer({
    orgId: "org",
    mode: {
      id: `${type.slug}-${mode.mode}-${mode.schedule}`,
      orgId: "org",
      eventTypeId: type.slug,
      mode: mode.mode,
      scheduleId: mode.schedule,
      priceCents: mode.priceCents ?? null,
      durationMinutes: null,
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      active: true,
    },
    eventType: {
      id: type.slug,
      expertProfileId: "expert",
      durationMinutes: type.durationMinutes,
      priceAmount: type.priceAmount,
      published: true,
      bookingWindowDays: null,
      minimumNoticeMinutes: 0,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      cancellationPolicy: "flexible",
      requiresApproval: false,
      instantBookLeadMinutes: null,
    },
  })
  if (!result.ok)
    throw new Error(`fixture offer did not resolve: ${result.error}`)
  return result.offer
}

const weekdayRules = OFFER_FIXTURE_WEEKDAYS.map((dayOfWeek) => ({
  dayOfWeek,
  startTime: OFFER_FIXTURE_DAY_START,
  endTime: OFFER_FIXTURE_DAY_END,
}))

function schedule(fixture: OfferFixture, name: string) {
  const found = fixture.schedules.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`missing fixture schedule ${name}`)
  return found
}

describe("offer fixtures (Phase 04 acceptance)", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date("2026-03-01T00:00:00Z"),
      toFake: ["Date"],
    })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  const quickChat = eventType(QUICK_CHAT_FIXTURE, "quick-chat")
  const followUp = eventType(PHYSIOTHERAPY_FIXTURE, "follow-up")

  it("Quick chat shows video and phone in Portugal, video only in Brazil", () => {
    expect(visibleModes(quickChat.modes, "PT", "pt")).toEqual([
      "online",
      "phone",
    ])
    expect(visibleModes(quickChat.modes, "BR", "pt")).toEqual(["online"])
  })

  it("Quick chat hides every mode for a language the expert does not offer", () => {
    expect(visibleModes(quickChat.modes, "PT", "de")).toEqual([])
  })

  it("Quick chat phone and video slots come from different schedules", () => {
    const [online, phone] = quickChat.modes
    expect(online?.schedule).not.toBe(phone?.schedule)
  })

  it("a phone booking blocks the overlapping video slot", () => {
    const online = quickChat.modes.find((mode) => mode.mode === "online")!
    const offer = resolve(quickChat, online)
    const input = {
      offer,
      schedule: schedule(QUICK_CHAT_FIXTURE, online.schedule),
      rules: weekdayRules,
      overrides: [],
      from: new Date("2026-03-02T00:00:00Z"),
      to: new Date("2026-03-03T00:00:00Z"),
      minimumNoticeMinutes: 0,
      bufferBeforeMinutes: 0,
    }
    const free = getAvailableSlotsForOffer({ ...input, existingBookings: [] })
    const phoneCall = {
      start: new Date("2026-03-02T10:00:00Z"),
      end: new Date("2026-03-02T10:20:00Z"),
    }
    const blocked = getAvailableSlotsForOffer({
      ...input,
      existingBookings: [phoneCall],
    })
    const startsAt = (slots: typeof free) =>
      slots.map((slot) => slot.start.toISOString())
    expect(startsAt(free)).toContain("2026-03-02T10:00:00.000Z")
    expect(startsAt(blocked)).not.toContain("2026-03-02T10:00:00.000Z")
    expect(blocked.length).toBeLessThan(free.length)
  })

  it("Physiotherapy follow-up has three location cards with their own price and schedule", () => {
    expect(followUp.modes).toHaveLength(3)
    expect(new Set(followUp.modes.map((mode) => mode.location)).size).toBe(3)
    expect(new Set(followUp.modes.map((mode) => mode.schedule)).size).toBe(3)
    const offers = followUp.modes.map((mode) => resolve(followUp, mode))
    expect(offers.map((offer) => offer.priceCents)).toEqual([4500, 4500, 5500])
  })

  it("Physiotherapy follow-up shows only the locations in the member's country", () => {
    const locationsFor = (country: string) =>
      followUp.modes
        .filter(
          (mode) =>
            assertModeBookable({
              active: true,
              countryScopeType: mode.countryScopeType,
              countryScopeCodes: mode.countryScopeCodes,
              languages: mode.languages,
              memberCountry: country,
              language: "pt",
            }).ok
        )
        .map((mode) => mode.location)
    expect(locationsFor("PT")).toEqual(["Lisboa", "Porto"])
    expect(locationsFor("ES")).toEqual(["Madrid"])
  })

  it("Madrid slots follow the Madrid clinic timezone", () => {
    const madrid = followUp.modes.find((mode) => mode.location === "Madrid")!
    const slots = getAvailableSlotsForOffer({
      offer: resolve(followUp, madrid),
      schedule: schedule(PHYSIOTHERAPY_FIXTURE, madrid.schedule),
      rules: weekdayRules,
      overrides: [],
      existingBookings: [],
      from: new Date("2026-03-02T00:00:00Z"),
      to: new Date("2026-03-03T00:00:00Z"),
      minimumNoticeMinutes: 0,
      bufferBeforeMinutes: 0,
    })
    // 09:00 in Madrid (CET, UTC+1) on 2 March 2026.
    expect(slots[0]?.start.toISOString()).toBe("2026-03-02T08:00:00.000Z")
    expect(slots[0]?.startLocal).toBe("2026-03-02T09:00:00")
  })

  it("every seeded mode passes the offer invariants", () => {
    for (const fixture of [QUICK_CHAT_FIXTURE, PHYSIOTHERAPY_FIXTURE]) {
      for (const type of fixture.eventTypes) {
        for (const mode of type.modes) {
          expect(invariantFor(fixture, type, mode)).toBeNull()
        }
      }
    }
  })

  it("rejects a clinical mode with worldwide scope", () => {
    const firstVisit = eventType(PHYSIOTHERAPY_FIXTURE, "first-visit")
    const online = firstVisit.modes[0]!
    expect(
      invariantFor(PHYSIOTHERAPY_FIXTURE, firstVisit, {
        ...online,
        countryScopeType: "worldwide",
        countryScopeCodes: [],
      })
    ).toBe("CLINICAL_WORLDWIDE")
  })
})
