import { describe, expect, it } from "vitest"
import {
  DEMO_BOOKING_LINK_TOKENS,
  hashDemoBookingLinkToken,
} from "./demo-booking-links"

describe("demo booking link tokens", () => {
  it("hashes plaintext tokens to sha256 hex", () => {
    for (const token of Object.values(DEMO_BOOKING_LINK_TOKENS)) {
      const hash = hashDemoBookingLinkToken(token)
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
      expect(hash).not.toBe(token)
    }
  })

  it("keeps the open and exhausted tokens distinct", () => {
    expect(DEMO_BOOKING_LINK_TOKENS.open).not.toBe(
      DEMO_BOOKING_LINK_TOKENS.exhausted
    )
    expect(hashDemoBookingLinkToken(DEMO_BOOKING_LINK_TOKENS.open)).not.toBe(
      hashDemoBookingLinkToken(DEMO_BOOKING_LINK_TOKENS.exhausted)
    )
  })
})
