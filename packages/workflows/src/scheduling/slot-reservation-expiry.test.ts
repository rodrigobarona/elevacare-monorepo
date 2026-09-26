import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  settleExpiredReservationIntent,
  listExpiredReservations,
  finalizeExpiredReservation,
  deferKeptReservation,
  captureException,
} = vi.hoisted(() => ({
  deferKeptReservation: vi.fn(async () => ({ deferred: true })),
  settleExpiredReservationIntent: vi.fn(),
  listExpiredReservations: vi.fn(),
  finalizeExpiredReservation: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock("@eleva/billing/server", () => ({ settleExpiredReservationIntent }))
vi.mock("@eleva/scheduling", () => ({
  INTENT_SEARCH_GRACE_MS: 10 * 60 * 1000,
  deferKeptReservation,
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
        intentPendingSince: null,
      },
      {
        id: "res-idle",
        orgId: "org-1",
        stripePaymentIntentId: "pi_idle",
        intentPendingSince: null,
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

    expect(deferKeptReservation).toHaveBeenCalledWith({
      orgId: "org-1",
      reservationId: "res-mbway",
      paymentIntentId: "pi_mbway",
      reason: "processing",
      now,
    })
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
      retried: 0,
      bookingsCancelled: 1,
      linkUsesReleased: 1,
      errors: 0,
    })
  })

  it("trusts an empty search only after the indexing grace period", async () => {
    listExpiredReservations.mockResolvedValue([
      {
        id: "res-fresh",
        orgId: "org-1",
        stripePaymentIntentId: null,
        intentPendingSince: new Date(now.getTime() - 2 * 60 * 1000),
      },
      {
        id: "res-stale",
        orgId: "org-1",
        stripePaymentIntentId: null,
        intentPendingSince: new Date(now.getTime() - 11 * 60 * 1000),
      },
    ])
    settleExpiredReservationIntent.mockImplementation(
      async (input: { searchMissIsFinal: boolean }) =>
        input.searchMissIsFinal
          ? { action: "release", cancelledIntentIds: [] }
          : { action: "retry", reason: "search_empty" }
    )
    finalizeExpiredReservation.mockResolvedValue({
      expired: true,
      bookingCancelled: true,
      linkUseReleased: false,
    })

    const result = await expireStaleReservations({ now })

    expect(settleExpiredReservationIntent).toHaveBeenCalledWith({
      reservationId: "res-fresh",
      paymentIntentId: null,
      searchByReservation: true,
      searchMissIsFinal: false,
    })
    expect(deferKeptReservation).toHaveBeenCalledWith({
      orgId: "org-1",
      reservationId: "res-fresh",
      paymentIntentId: null,
      reason: "search_empty",
      now,
      recheckMs: 60 * 1000,
    })
    expect(finalizeExpiredReservation).toHaveBeenCalledTimes(1)
    expect(finalizeExpiredReservation).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "res-stale" })
    )
    expect(result).toMatchObject({ retried: 1, expired: 1 })
  })

  it("leaves the reservation active when Stripe fails so the next run retries", async () => {
    listExpiredReservations.mockResolvedValue([
      {
        id: "res-err",
        orgId: "org-1",
        stripePaymentIntentId: "pi_err",
        intentPendingSince: null,
      },
    ])
    settleExpiredReservationIntent.mockRejectedValue(new Error("stripe down"))

    const result = await expireStaleReservations({ now })

    expect(finalizeExpiredReservation).not.toHaveBeenCalled()
    expect(result.errors).toBe(1)
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
