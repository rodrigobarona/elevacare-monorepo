import { describe, expect, it } from "vitest"

const {
  authorizeReservationAccess,
  hashReservationToken,
  parseReservationFunnel,
  paymentIntentIdempotencyKey,
  reservationBookabilityTargets,
} = await import("./payments")

describe("hashReservationToken", () => {
  it("returns the sha256 hex of the raw token", () => {
    expect(hashReservationToken("abc")).toMatch(/^[a-f0-9]{64}$/)
    expect(hashReservationToken("abc")).toBe(hashReservationToken("abc"))
    expect(hashReservationToken("abc")).not.toBe(hashReservationToken("def"))
  })
})

describe("paymentIntentIdempotencyKey", () => {
  it("is the Checkout Session key per reservation id", () => {
    expect(
      paymentIntentIdempotencyKey("22222222-2222-4222-8222-222222222222")
    ).toBe("cs:22222222-2222-4222-8222-222222222222")
  })
})

describe("authorizeReservationAccess", () => {
  function base() {
    const reservationToken = "reservation-token-16"
    return {
      authorizeReservationAccess,
      reservationToken,
      capabilityHash: hashReservationToken(reservationToken),
    }
  }

  it("accepts a matching token for an active hold", async () => {
    const { authorizeReservationAccess, reservationToken, capabilityHash } =
      base()
    expect(
      authorizeReservationAccess({
        capabilityHash,
        reservationToken,
        reservationUserId: null,
        status: "active",
        expiresAt: new Date(Date.now() + 60_000),
        linkRevoked: false,
      })
    ).toBe("ok")
  })

  it("returns not_found for a token mismatch", async () => {
    const { authorizeReservationAccess, capabilityHash } = base()
    expect(
      authorizeReservationAccess({
        capabilityHash,
        reservationToken: "different-token-16",
        reservationUserId: null,
        status: "active",
        expiresAt: new Date(Date.now() + 60_000),
        linkRevoked: false,
      })
    ).toBe("not_found")
  })

  it("returns not_found when a bound user does not match the session", async () => {
    const { authorizeReservationAccess, reservationToken, capabilityHash } =
      base()
    expect(
      authorizeReservationAccess({
        capabilityHash,
        reservationToken,
        reservationUserId: "user-1",
        sessionUserId: "user-2",
        status: "active",
        expiresAt: new Date(Date.now() + 60_000),
        linkRevoked: false,
      })
    ).toBe("not_found")
  })

  it("returns not_found for an expired, inactive, or revoked-link hold", async () => {
    const { authorizeReservationAccess, reservationToken, capabilityHash } =
      base()
    const ok = {
      capabilityHash,
      reservationToken,
      reservationUserId: null,
      status: "active",
      expiresAt: new Date(Date.now() + 60_000),
      linkRevoked: false,
    }
    expect(
      authorizeReservationAccess({ ...ok, expiresAt: new Date(Date.now() - 1) })
    ).toBe("not_found")
    expect(authorizeReservationAccess({ ...ok, status: "expired" })).toBe(
      "not_found"
    )
    expect(authorizeReservationAccess({ ...ok, linkRevoked: true })).toBe(
      "not_found"
    )
  })
})

describe("reservationBookabilityTargets", () => {
  it("checks the reserved guest email even when the payer has a session", () => {
    expect(
      reservationBookabilityTargets({
        reservationUserId: null,
        sessionUserId: "user-1",
        guestEmail: "blocked@example.com",
      })
    ).toEqual({ memberId: "user-1", guestEmail: "blocked@example.com" })
  })

  it("uses only the bound member for member reservations", () => {
    expect(
      reservationBookabilityTargets({
        reservationUserId: "user-2",
        sessionUserId: "user-2",
        guestEmail: "other@example.com",
      })
    ).toEqual({ memberId: "user-2", guestEmail: undefined })
  })
})

describe("parseReservationFunnel", () => {
  it("accepts a complete snapshot and rejects a missing timezone", () => {
    const snapshot = {
      timezone: "Europe/Lisbon",
      language: "pt",
      memberCountry: "PT",
      bookingLinkId: null,
      sessionMode: "online" as const,
    }
    expect(parseReservationFunnel(snapshot).success).toBe(true)
    const lowercase = parseReservationFunnel({
      ...snapshot,
      memberCountry: "pt",
    })
    expect(lowercase.success).toBe(true)
    if (lowercase.success) {
      expect(lowercase.data.memberCountry).toBe("PT")
    }
    const incomplete = { ...snapshot, timezone: undefined }
    expect(parseReservationFunnel(incomplete).success).toBe(false)
  })
})
