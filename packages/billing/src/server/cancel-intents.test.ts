import { describe, expect, it, vi } from "vitest"

const retrieve = vi.fn()
const cancel = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    paymentIntents: { retrieve, cancel },
  }),
}))

import { cancelCancelablePaymentIntents } from "./cancel-intents"

describe("cancelCancelablePaymentIntents", () => {
  it("cancels only cancelable intents and never refunds", async () => {
    retrieve.mockImplementation(async (id: string) => {
      if (id === "pi_open") return { status: "requires_payment_method" }
      if (id === "pi_paid") return { status: "succeeded" }
      return { status: "canceled" }
    })
    cancel.mockResolvedValue({ status: "canceled" })

    await cancelCancelablePaymentIntents(["pi_open", "pi_paid", "pi_done"])
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith("pi_open")
  })
})
