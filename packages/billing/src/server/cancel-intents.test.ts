import { describe, expect, it, vi, beforeEach } from "vitest"

const retrieve = vi.fn()
const cancel = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    paymentIntents: { retrieve, cancel },
  }),
}))

import { cancelCancelablePaymentIntents } from "./cancel-intents"

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
