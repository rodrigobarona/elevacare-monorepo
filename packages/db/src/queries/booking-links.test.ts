import { describe, expect, it } from "vitest"
import { deriveBookingLinkStatus } from "./booking-links"

describe("deriveBookingLinkStatus", () => {
  const now = new Date("2026-09-24T12:00:00.000Z")

  it("returns revoked when revokedAt is set", () => {
    expect(
      deriveBookingLinkStatus(
        {
          revokedAt: new Date("2026-09-20T00:00:00.000Z"),
          expiresAt: new Date("2026-10-01T00:00:00.000Z"),
          useCount: 0,
          maxUses: 1,
        },
        now
      )
    ).toBe("revoked")
  })

  it("returns expired when past expiresAt", () => {
    expect(
      deriveBookingLinkStatus(
        {
          revokedAt: null,
          expiresAt: new Date("2026-09-01T00:00:00.000Z"),
          useCount: 0,
          maxUses: 1,
        },
        now
      )
    ).toBe("expired")
  })

  it("returns used when useCount reaches maxUses", () => {
    expect(
      deriveBookingLinkStatus(
        {
          revokedAt: null,
          expiresAt: new Date("2026-10-01T00:00:00.000Z"),
          useCount: 1,
          maxUses: 1,
        },
        now
      )
    ).toBe("used")
  })

  it("returns active otherwise", () => {
    expect(
      deriveBookingLinkStatus(
        {
          revokedAt: null,
          expiresAt: new Date("2026-10-01T00:00:00.000Z"),
          useCount: 0,
          maxUses: 2,
        },
        now
      )
    ).toBe("active")
  })
})
