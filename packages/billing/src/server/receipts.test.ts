import { beforeEach, describe, expect, it, vi } from "vitest"

const retrieve = vi.fn()
const retrieveIntent = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    charges: { retrieve },
    paymentIntents: { retrieve: retrieveIntent },
  }),
}))

describe("retrieveChargeReceipt", () => {
  beforeEach(() => {
    retrieve.mockReset()
    retrieveIntent.mockReset()
  })

  it("returns receipt_url from a charge id", async () => {
    retrieve.mockResolvedValue({
      id: "ch_1",
      receipt_url: "https://pay.stripe.com/receipts/ch_1",
    })
    const { retrieveChargeReceipt } = await import("./receipts")
    await expect(
      retrieveChargeReceipt({ stripeChargeId: "ch_1" })
    ).resolves.toEqual({
      receiptUrl: "https://pay.stripe.com/receipts/ch_1",
      stripeChargeId: "ch_1",
    })
    expect(retrieveIntent).not.toHaveBeenCalled()
  })

  it("falls back to PaymentIntent latest_charge", async () => {
    retrieveIntent.mockResolvedValue({
      latest_charge: {
        id: "ch_2",
        receipt_url: "https://pay.stripe.com/receipts/ch_2",
      },
    })
    const { retrieveChargeReceipt } = await import("./receipts")
    await expect(
      retrieveChargeReceipt({ stripePaymentIntentId: "pi_2" })
    ).resolves.toEqual({
      receiptUrl: "https://pay.stripe.com/receipts/ch_2",
      stripeChargeId: "ch_2",
    })
  })
})
