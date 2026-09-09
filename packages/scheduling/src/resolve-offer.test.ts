import { describe, expect, it } from "vitest"
import {
  composeResolvedOffer,
  hashBookingLinkToken,
  isUsableBookingLink,
  type OfferEventTypeRow,
  type OfferLinkRow,
  type OfferModeRow,
} from "./resolve-offer"

const mode: OfferModeRow = {
  id: "mode-1",
  orgId: "org-1",
  eventTypeId: "et-1",
  mode: "online",
  scheduleId: "sched-public",
  priceCents: 4500,
  durationMinutes: 25,
  countryScopeType: "worldwide",
  countryScopeCodes: [],
  languages: ["pt", "en"],
  active: true,
}

const eventType: OfferEventTypeRow = {
  id: "et-1",
  expertProfileId: "expert-1",
  durationMinutes: 30,
  priceAmount: 6000,
}

const now = new Date("2026-09-09T12:00:00Z")

function link(overrides: Partial<OfferLinkRow> = {}): OfferLinkRow {
  return {
    id: "link-1",
    orgId: "org-1",
    eventTypeId: "et-1",
    eventTypeModeId: "mode-1",
    scheduleId: "sched-private",
    priceCents: 1000,
    revokedAt: null,
    expiresAt: new Date("2026-09-10T12:00:00Z"),
    useCount: 0,
    maxUses: 1,
    recipientEmail: null,
    ...overrides,
  }
}

describe("composeResolvedOffer", () => {
  it("returns not_found for an inactive mode", () => {
    expect(
      composeResolvedOffer({
        orgId: "org-1",
        mode: { ...mode, active: false },
        eventType,
        now,
      })
    ).toEqual({ ok: false, error: "not_found" })
  })

  it("uses mode schedule, price, and duration when no link is present", () => {
    const result = composeResolvedOffer({
      orgId: "org-1",
      mode,
      eventType,
      now,
    })
    expect(result).toMatchObject({
      ok: true,
      offer: {
        scheduleId: "sched-public",
        priceCents: 4500,
        durationMinutes: 25,
      },
    })
    if (result.ok) {
      expect(result.offer.bookingLinkId).toBeUndefined()
    }
  })

  it("falls back to the event type price and duration", () => {
    const result = composeResolvedOffer({
      orgId: "org-1",
      mode: { ...mode, priceCents: null, durationMinutes: null },
      eventType,
      now,
    })
    expect(result).toMatchObject({
      ok: true,
      offer: { priceCents: 6000, durationMinutes: 30 },
    })
  })

  it("applies a valid link schedule and price override", () => {
    const result = composeResolvedOffer({
      orgId: "org-1",
      mode,
      eventType,
      link: link(),
      now,
    })
    expect(result).toMatchObject({
      ok: true,
      offer: {
        scheduleId: "sched-private",
        priceCents: 1000,
        bookingLinkId: "link-1",
      },
    })
  })

  it("falls back to the mode schedule when the link has no schedule", () => {
    const result = composeResolvedOffer({
      orgId: "org-1",
      mode,
      eventType,
      link: link({ scheduleId: null }),
      now,
    })
    expect(result).toMatchObject({
      ok: true,
      offer: { scheduleId: "sched-public", bookingLinkId: "link-1" },
    })
  })

  it("keeps a zero-cent link price instead of falling back", () => {
    const result = composeResolvedOffer({
      orgId: "org-1",
      mode,
      eventType,
      link: link({ priceCents: 0 }),
      now,
    })
    expect(result).toMatchObject({ ok: true, offer: { priceCents: 0 } })
  })

  it("accepts a link with a null eventTypeModeId as a wildcard", () => {
    const result = composeResolvedOffer({
      orgId: "org-1",
      mode,
      eventType,
      link: link({ eventTypeModeId: null }),
      now,
    })
    expect(result).toMatchObject({
      ok: true,
      offer: { bookingLinkId: "link-1", priceCents: 1000 },
    })
  })

  it("returns not_found for revoked, expired, exhausted, or mismatched links", () => {
    const cases: OfferLinkRow[] = [
      link({ revokedAt: now }),
      link({ expiresAt: now }),
      link({ useCount: 1, maxUses: 1 }),
      link({ orgId: "org-other" }),
      link({ eventTypeId: "et-other" }),
      link({ eventTypeModeId: "mode-other" }),
    ]
    for (const row of cases) {
      expect(
        composeResolvedOffer({
          orgId: "org-1",
          mode,
          eventType,
          link: row,
          now,
        })
      ).toEqual({ ok: false, error: "not_found" })
    }
  })

  it("returns not_found when a recipient-restricted link email does not match", () => {
    const restricted = link({ recipientEmail: "invitee@eleva.care" })
    expect(
      composeResolvedOffer({
        orgId: "org-1",
        mode,
        eventType,
        link: restricted,
        now,
        viewerEmail: "other@eleva.care",
        enforceRecipient: true,
      })
    ).toEqual({ ok: false, error: "not_found" })
    expect(
      composeResolvedOffer({
        orgId: "org-1",
        mode,
        eventType,
        link: restricted,
        now,
        enforceRecipient: true,
      })
    ).toEqual({ ok: false, error: "not_found" })
  })

  it("matches a recipient-restricted link case-insensitively", () => {
    expect(
      composeResolvedOffer({
        orgId: "org-1",
        mode,
        eventType,
        link: link({ recipientEmail: "invitee@eleva.care" }),
        now,
        viewerEmail: "Invitee@Eleva.care",
        enforceRecipient: true,
      })
    ).toMatchObject({ ok: true, offer: { bookingLinkId: "link-1" } })
  })

  it("does not enforce the recipient when enforceRecipient is omitted", () => {
    expect(
      composeResolvedOffer({
        orgId: "org-1",
        mode,
        eventType,
        link: link({ recipientEmail: "invitee@eleva.care" }),
        now,
      })
    ).toMatchObject({ ok: true })
  })
})

describe("booking link helpers", () => {
  it("hashes the raw token with sha256 hex", () => {
    expect(hashBookingLinkToken("secret")).toHaveLength(64)
    expect(hashBookingLinkToken("secret")).not.toBe("secret")
  })

  it("treats a future unused link as usable", () => {
    expect(isUsableBookingLink(link(), now)).toBe(true)
  })

  it("rejects revoked, expired, and exhausted links", () => {
    expect(isUsableBookingLink(link({ revokedAt: now }), now)).toBe(false)
    expect(isUsableBookingLink(link({ expiresAt: now }), now)).toBe(false)
    expect(isUsableBookingLink(link({ useCount: 1, maxUses: 1 }), now)).toBe(
      false
    )
  })
})
