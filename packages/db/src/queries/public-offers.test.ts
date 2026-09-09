import { describe, expect, it } from "vitest"
import {
  decodeMarketplaceCursor,
  encodeMarketplaceCursor,
  isBookingLinkUsable,
} from "./public-offers"

describe("marketplace cursor", () => {
  it("round-trips an offset", () => {
    const encoded = encodeMarketplaceCursor(48)
    expect(decodeMarketplaceCursor(encoded)).toBe(48)
  })

  it("treats a missing or malformed cursor as the first page", () => {
    expect(decodeMarketplaceCursor()).toBe(0)
    expect(decodeMarketplaceCursor("not-base64")).toBe(0)
    expect(decodeMarketplaceCursor(encodeMarketplaceCursor(-3))).toBe(0)
  })
})

describe("isBookingLinkUsable", () => {
  const now = new Date("2026-09-09T12:00:00Z")
  const usable = {
    revokedAt: null,
    expiresAt: new Date("2026-09-10T12:00:00Z"),
    useCount: 0,
    maxUses: 1,
  }

  it("accepts a future unused link", () => {
    expect(isBookingLinkUsable(usable, now)).toBe(true)
  })

  it("rejects revoked, expired, and exhausted links", () => {
    expect(isBookingLinkUsable({ ...usable, revokedAt: now }, now)).toBe(false)
    expect(isBookingLinkUsable({ ...usable, expiresAt: now }, now)).toBe(false)
    expect(
      isBookingLinkUsable({ ...usable, useCount: 1, maxUses: 1 }, now)
    ).toBe(false)
  })
})
