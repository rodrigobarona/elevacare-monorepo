import { beforeEach, describe, expect, it, vi } from "vitest"

const reservationId = "11111111-1111-4111-8111-111111111111"
const bookingId = "22222222-2222-4222-8222-222222222222"
const paymentId = "33333333-3333-4333-8333-333333333333"
const orgId = "44444444-4444-4444-8444-444444444444"
const paymentIntentId = "pi_test_confirm"

function intentSnapshot(
  overrides: Partial<{
    status: string
    amount: number
    currency: string
    reservationId: string
  }> = {}
) {
  return {
    id: paymentIntentId,
    status: overrides.status ?? "succeeded",
    amount: overrides.amount ?? 5000,
    currency: overrides.currency ?? "eur",
    metadata: {
      reservationId: overrides.reservationId ?? reservationId,
      bookingId,
      expertOrgId: orgId,
    },
    paymentMethodType: "card",
  }
}

describe("authorizeConfirmAccess", () => {
  it("accepts a matching token for an active hold", async () => {
    const { authorizeConfirmAccess, hashReservationToken } =
      await import("../src/confirm-booking")
    const reservationToken = "reservation-token-16"
    expect(
      authorizeConfirmAccess({
        capabilityHash: hashReservationToken(reservationToken),
        reservationToken,
        reservationUserId: null,
        status: "active",
        linkRevoked: false,
        hasBoundIntent: false,
      })
    ).toBe("ok")
  })

  it("returns not_found when the booking link is revoked and unpaid", async () => {
    const { authorizeConfirmAccess, hashReservationToken } =
      await import("../src/confirm-booking")
    const reservationToken = "reservation-token-16"
    expect(
      authorizeConfirmAccess({
        capabilityHash: hashReservationToken(reservationToken),
        reservationToken,
        reservationUserId: null,
        status: "active",
        linkRevoked: true,
        hasBoundIntent: false,
      })
    ).toBe("not_found")
  })

  it("allows a revoked link after the intent is bound", async () => {
    const { authorizeConfirmAccess, hashReservationToken } =
      await import("../src/confirm-booking")
    const reservationToken = "reservation-token-16"
    expect(
      authorizeConfirmAccess({
        capabilityHash: hashReservationToken(reservationToken),
        reservationToken,
        reservationUserId: null,
        status: "active",
        linkRevoked: true,
        hasBoundIntent: true,
      })
    ).toBe("ok")
  })
})

describe("isUniqueViolation", () => {
  it("detects nested postgres 23505 errors", async () => {
    const { isUniqueViolation } = await import("../src/confirm-booking")
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isUniqueViolation(new Error("nope"))).toBe(false)
  })
})

describe("confirmBookingPayment", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns not_found when the public path omits reservationToken", async () => {
    const { confirmBookingPayment } = await import("../src/confirm-booking")
    const result = await confirmBookingPayment({
      reservationId,
      paymentIntentId,
      source: "public",
      retrieveIntent: async () => intentSnapshot(),
    })
    expect(result).toEqual({ ok: false, error: "not_found" })
  })

  it("returns unavailable when Stripe retrieve throws", async () => {
    vi.doMock("@eleva/audit", () => ({
      withAudit: vi.fn(async (_opts, fn) => fn({}, { emit: vi.fn() })),
    }))
    vi.doMock("@eleva/db", () => ({
      main: {},
      withPlatformAdminContext: vi.fn(),
    }))
    const { confirmBookingPayment } = await import("../src/confirm-booking")
    const result = await confirmBookingPayment({
      reservationId,
      paymentIntentId,
      reservationToken: "reservation-token-16",
      source: "public",
      retrieveIntent: async () => {
        throw new Error("stripe down")
      },
    })
    expect(result).toEqual({ ok: false, error: "unavailable" })
  })

  it("returns payment_mismatch when the intent belongs to another reservation", async () => {
    const emit = vi.fn()
    vi.doMock("@eleva/audit", () => ({
      withAudit: vi.fn(async (_opts, fn) => fn({}, { emit })),
    }))
    vi.doMock("@eleva/db", () => {
      const reservation = {
        id: reservationId,
        orgId,
        capabilityHash: "a".repeat(64),
        userId: null,
        status: "active",
        priceCents: 5000,
        currency: "EUR",
        stripePaymentIntentId: paymentIntentId,
        funnel: null,
      }
      const booking = {
        id: bookingId,
        status: "pending_payment",
        stripePaymentIntentId: paymentIntentId,
        guestEmail: "member@example.com",
        guestName: "Member",
      }
      const payment = {
        id: paymentId,
        status: "requires_payment",
        stripePaymentIntentId: paymentIntentId,
      }
      return {
        main: {
          slotReservations: { id: "id" },
          bookings: { id: "id", orgId: "org", reservationId: "res" },
          bookingPayments: {
            id: "id",
            orgId: "org",
            bookingId: "bid",
            stripePaymentIntentId: "pi",
          },
          bookingLinks: { id: "id", orgId: "org", revokedAt: "revoked" },
        },
        withPlatformAdminContext: vi.fn(
          async (fn: (tx: unknown) => unknown) => {
            const limit = vi
              .fn()
              .mockResolvedValueOnce([reservation])
              .mockResolvedValueOnce([booking])
              .mockResolvedValueOnce([payment])
              .mockResolvedValue([])
            const tx = {
              select: () => ({
                from: () => ({
                  where: () => ({ limit }),
                }),
              }),
            }
            return fn(tx)
          }
        ),
      }
    })

    const { confirmBookingPayment } = await import("../src/confirm-booking")
    const result = await confirmBookingPayment({
      reservationId,
      paymentIntentId,
      source: "webhook",
      retrieveIntent: async () =>
        intentSnapshot({
          reservationId: "99999999-9999-4999-8999-999999999999",
        }),
    })
    expect(result).toEqual({ ok: false, error: "payment_mismatch" })
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "booking_payment",
        action: "rejected",
      })
    )
  })
})
