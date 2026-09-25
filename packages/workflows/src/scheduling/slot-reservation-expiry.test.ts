import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  settleExpiredReservationIntent,
  listExpiredReservations,
  finalizeExpiredReservation,
  captureException,
} = vi.hoisted(() => ({
  settleExpiredReservationIntent: vi.fn(),
  listExpiredReservations: vi.fn(),
  finalizeExpiredReservation: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock("@eleva/billing/server", () => ({ settleExpiredReservationIntent }))
vi.mock("@eleva/scheduling", () => ({
  listExpiredReservations,
  finalizeExpiredReservation,
}))
vi.mock("@eleva/observability", () => ({
  captureException,
  heartbeat: vi.fn(async () => undefined),
}))

import { expireStaleReservations } from "./slot-reservation-expiry"

const now = new Date("2026-09-25T12:00:00.000Z")

describe("expireStaleReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps a processing MB WAY hold and expires an idle one", async () => {
    listExpiredReservations.mockResolvedValue([
      {
        id: "res-mbway",
        orgId: "org-1",
        stripePaymentIntentId: "pi_mbway",
        hasIntentPendingPayment: false,
      },
      {
        id: "res-idle",
        orgId: "org-1",
        stripePaymentIntentId: "pi_idle",
        hasIntentPendingPayment: false,
      },
    ])
    settleExpiredReservationIntent.mockImplementation(
      async (input: { paymentIntentId: string }) =>
        input.paymentIntentId === "pi_mbway"
          ? {
              action: "keep",
              paymentIntentId: "pi_mbway",
              reason: "processing",
            }
          : { action: "release", cancelledIntentIds: ["pi_idle"] }
    )
    finalizeExpiredReservation.mockResolvedValue({
      expired: true,
      bookingCancelled: true,
      linkUseReleased: true,
    })

    const result = await expireStaleReservations({ now })

    expect(finalizeExpiredReservation).toHaveBeenCalledTimes(1)
    expect(finalizeExpiredReservation).toHaveBeenCalledWith({
      orgId: "org-1",
      reservationId: "res-idle",
      cancelledIntentIds: ["pi_idle"],
      now,
    })
    expect(result).toEqual({
      scanned: 2,
      expired: 1,
      kept: 1,
      bookingsCancelled: 1,
      linkUsesReleased: 1,
      errors: 0,
    })
  })

  it("searches Stripe only for intent_pending reservations", async () => {
    listExpiredReservations.mockResolvedValue([
      {
        id: "res-pending",
        orgId: "org-1",
        stripePaymentIntentId: null,
        hasIntentPendingPayment: true,
      },
    ])
    settleExpiredReservationIntent.mockResolvedValue({
      action: "release",
      cancelledIntentIds: [],
    })
    finalizeExpiredReservation.mockResolvedValue({
      expired: true,
      bookingCancelled: true,
      linkUseReleased: false,
    })

    await expireStaleReservations({ now })

    expect(settleExpiredReservationIntent).toHaveBeenCalledWith({
      reservationId: "res-pending",
      paymentIntentId: null,
      searchByReservation: true,
    })
  })

  it("leaves the reservation active when Stripe fails so the next run retries", async () => {
    listExpiredReservations.mockResolvedValue([
      {
        id: "res-err",
        orgId: "org-1",
        stripePaymentIntentId: "pi_err",
        hasIntentPendingPayment: false,
      },
    ])
    settleExpiredReservationIntent.mockRejectedValue(new Error("stripe down"))

    const result = await expireStaleReservations({ now })

    expect(finalizeExpiredReservation).not.toHaveBeenCalled()
    expect(result.errors).toBe(1)
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
