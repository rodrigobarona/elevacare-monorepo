import { beforeEach, describe, expect, it, vi } from "vitest"

const create = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({ paymentIntents: { create } }),
}))

const envState: {
  STRIPE_PMC_BOOKING: string | undefined
  STRIPE_PUBLISHABLE_KEY: string
} = {
  STRIPE_PMC_BOOKING: "pmc_test_booking",
  STRIPE_PUBLISHABLE_KEY: "pk_test_booking",
}

vi.mock("@eleva/config/env", () => ({
  env: () => envState,
}))

describe("hashReservationToken", () => {
  it("returns the sha256 hex of the raw token", async () => {
    const { hashReservationToken } = await import("./payments")
    expect(hashReservationToken("abc")).toMatch(/^[a-f0-9]{64}$/)
    expect(hashReservationToken("abc")).toBe(hashReservationToken("abc"))
    expect(hashReservationToken("abc")).not.toBe(hashReservationToken("def"))
  })
})

describe("paymentIntentIdempotencyKey", () => {
  it("is stable per reservation id", async () => {
    const { paymentIntentIdempotencyKey } = await import("./payments")
    expect(
      paymentIntentIdempotencyKey("22222222-2222-4222-8222-222222222222")
    ).toBe("pi:22222222-2222-4222-8222-222222222222")
  })
})

describe("authorizeReservationAccess", () => {
  async function base() {
    const { authorizeReservationAccess, hashReservationToken } =
      await import("./payments")
    const reservationToken = "reservation-token-16"
    return {
      authorizeReservationAccess,
      reservationToken,
      capabilityHash: hashReservationToken(reservationToken),
    }
  }

  it("accepts a matching token for an active hold", async () => {
    const { authorizeReservationAccess, reservationToken, capabilityHash } =
      await base()
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
    const { authorizeReservationAccess, capabilityHash } = await base()
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
      await base()
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
      await base()
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

describe("parseReservationFunnel", () => {
  it("accepts a complete snapshot and rejects a missing timezone", async () => {
    const { parseReservationFunnel } = await import("./payments")
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

describe("createBookingPaymentIntent", () => {
  beforeEach(() => {
    create.mockReset()
  })

  it("creates a platform charge with PMC and no transfer_data", async () => {
    create.mockResolvedValue({ id: "pi_1", client_secret: "secret" })
    const { createBookingPaymentIntent } = await import("./payments")
    await createBookingPaymentIntent({
      amountCents: 4500,
      currency: "EUR",
      bookingId: "11111111-1111-4111-8111-111111111111",
      reservationId: "22222222-2222-4222-8222-222222222222",
      expertOrgId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "pi:22222222-2222-4222-8222-222222222222",
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4500,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        payment_method_configuration: "pmc_test_booking",
        transfer_group: "11111111-1111-4111-8111-111111111111",
        metadata: expect.objectContaining({
          bookingId: "11111111-1111-4111-8111-111111111111",
          reservationId: "22222222-2222-4222-8222-222222222222",
          expertOrgId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
      { idempotencyKey: "pi:22222222-2222-4222-8222-222222222222" }
    )
    const body = create.mock.calls[0]?.[0] as Record<string, unknown>
    expect(body).not.toHaveProperty("payment_method_types")
    expect(body).not.toHaveProperty("transfer_data")
    expect(body).not.toHaveProperty("application_fee_amount")
  })

  it("refuses to create when STRIPE_PMC_BOOKING is missing", async () => {
    envState.STRIPE_PMC_BOOKING = undefined
    try {
      const { createBookingPaymentIntent } = await import("./payments")
      await expect(
        createBookingPaymentIntent({
          amountCents: 4500,
          currency: "EUR",
          bookingId: "11111111-1111-4111-8111-111111111111",
          reservationId: "22222222-2222-4222-8222-222222222222",
          expertOrgId: "33333333-3333-4333-8333-333333333333",
          idempotencyKey: "pi:22222222-2222-4222-8222-222222222222",
        })
      ).rejects.toThrow("STRIPE_PMC_BOOKING is not configured")
    } finally {
      envState.STRIPE_PMC_BOOKING = "pmc_test_booking"
    }
  })

  it("passes the snapshot currency through and does not hardcode EUR", async () => {
    create.mockResolvedValue({ id: "pi_2", client_secret: "secret" })
    const { createBookingPaymentIntent } = await import("./payments")
    await createBookingPaymentIntent({
      amountCents: 4500,
      currency: "CHF",
      bookingId: "11111111-1111-4111-8111-111111111111",
      reservationId: "22222222-2222-4222-8222-222222222222",
      expertOrgId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "pi:22222222-2222-4222-8222-222222222222",
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "chf" }),
      expect.anything()
    )
  })
})
