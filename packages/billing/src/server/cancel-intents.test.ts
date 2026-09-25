import { describe, expect, it, vi, beforeEach } from "vitest"

const retrieve = vi.fn()
const cancel = vi.fn()
const search = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    paymentIntents: { retrieve, cancel, search },
  }),
}))

import {
  cancelCancelablePaymentIntents,
  settleExpiredReservationIntent,
} from "./cancel-intents"

describe("cancelCancelablePaymentIntents", () => {
  beforeEach(() => {
    retrieve.mockReset()
    cancel.mockReset()
  })

  it("cancels only cancelable intents and never refunds", async () => {
    retrieve.mockImplementation(async (id: string) => {
      if (id === "pi_open") return { status: "requires_payment_method" }
      if (id === "pi_paid") return { status: "succeeded" }
      return { status: "canceled" }
    })
    cancel.mockResolvedValue({ status: "canceled" })

    const outcomes = await cancelCancelablePaymentIntents([
      "pi_open",
      "pi_paid",
      "pi_done",
    ])
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith("pi_open")
    expect(outcomes).toEqual([
      { id: "pi_open", status: "cancelled" },
      { id: "pi_paid", status: "skipped", reason: "succeeded" },
      { id: "pi_done", status: "skipped", reason: "canceled" },
    ])
  })

  it("cancels processing intents and reports Stripe failures", async () => {
    retrieve.mockImplementation(async (id: string) => {
      if (id === "pi_processing") return { status: "processing" }
      if (id === "pi_fail") return { status: "requires_confirmation" }
      return { status: "requires_action" }
    })
    cancel.mockImplementation(async (id: string) => {
      if (id === "pi_fail") {
        const err = new Error("stripe down") as Error & { code?: string }
        throw err
      }
      return { status: "canceled" }
    })

    const outcomes = await cancelCancelablePaymentIntents([
      "pi_processing",
      "pi_fail",
    ])
    expect(cancel).toHaveBeenCalledWith("pi_processing")
    expect(outcomes).toEqual([
      { id: "pi_processing", status: "cancelled" },
      {
        id: "pi_fail",
        status: "failed",
        reason: "stripe down",
      },
    ])
  })
})

describe("settleExpiredReservationIntent", () => {
  const reservationId = "5f0c2a4e-8a3b-4c1d-9e2f-1a2b3c4d5e6f"

  beforeEach(() => {
    retrieve.mockReset()
    cancel.mockReset()
    search.mockReset()
  })

  it("keeps an MB WAY hold whose intent is processing", async () => {
    retrieve.mockResolvedValue({ id: "pi_mbway", status: "processing" })

    await expect(
      settleExpiredReservationIntent({
        reservationId,
        paymentIntentId: "pi_mbway",
        searchByReservation: false,
        searchMissIsFinal: true,
      })
    ).resolves.toEqual({
      action: "keep",
      paymentIntentId: "pi_mbway",
      reason: "processing",
    })
    expect(cancel).not.toHaveBeenCalled()
  })

  it("cancels an idle intent and releases the hold", async () => {
    retrieve.mockResolvedValue({
      id: "pi_idle",
      status: "requires_payment_method",
    })
    cancel.mockResolvedValue({ status: "canceled" })

    await expect(
      settleExpiredReservationIntent({
        reservationId,
        paymentIntentId: "pi_idle",
        searchByReservation: false,
        searchMissIsFinal: true,
      })
    ).resolves.toEqual({ action: "release", cancelledIntentIds: ["pi_idle"] })
    expect(cancel).toHaveBeenCalledWith("pi_idle")
  })

  it("finds an intent_pending intent by reservation metadata", async () => {
    search.mockResolvedValue({
      data: [{ id: "pi_orphan", status: "requires_payment_method" }],
    })
    cancel.mockResolvedValue({ status: "canceled" })

    const decision = await settleExpiredReservationIntent({
      reservationId,
      paymentIntentId: null,
      searchByReservation: true,
      searchMissIsFinal: false,
    })

    expect(search).toHaveBeenCalledWith({
      query: `metadata['reservationId']:'${reservationId}'`,
      limit: 10,
    })
    expect(decision).toEqual({
      action: "release",
      cancelledIntentIds: ["pi_orphan"],
    })
  })

  it("asks for a retry while an empty search may still be indexing", async () => {
    search.mockResolvedValue({ data: [] })

    await expect(
      settleExpiredReservationIntent({
        reservationId,
        paymentIntentId: null,
        searchByReservation: true,
        searchMissIsFinal: false,
      })
    ).resolves.toEqual({ action: "retry", reason: "search_empty" })

    await expect(
      settleExpiredReservationIntent({
        reservationId,
        paymentIntentId: null,
        searchByReservation: true,
        searchMissIsFinal: true,
      })
    ).resolves.toEqual({ action: "release", cancelledIntentIds: [] })
  })

  it("releases without calling Stripe when no intent can exist", async () => {
    await expect(
      settleExpiredReservationIntent({
        reservationId,
        paymentIntentId: null,
        searchByReservation: false,
        searchMissIsFinal: true,
      })
    ).resolves.toEqual({ action: "release", cancelledIntentIds: [] })
    expect(retrieve).not.toHaveBeenCalled()
    expect(search).not.toHaveBeenCalled()
  })

  it("keeps the hold when the intent moved on before cancel", async () => {
    retrieve.mockResolvedValue({ id: "pi_race", status: "requires_action" })
    cancel.mockRejectedValue(
      Object.assign(new Error("unexpected"), {
        code: "payment_intent_unexpected_state",
      })
    )

    await expect(
      settleExpiredReservationIntent({
        reservationId,
        paymentIntentId: "pi_race",
        searchByReservation: false,
        searchMissIsFinal: true,
      })
    ).resolves.toEqual({
      action: "keep",
      paymentIntentId: "pi_race",
      reason: "payment_intent_unexpected_state",
    })
  })
})
