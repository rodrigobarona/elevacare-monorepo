import { describe, expect, it } from "vitest"
import { classifyPaymentMethod } from "./payment-method-policy"

describe("classifyPaymentMethod", () => {
  it("classifies card, Link, and wallets as synchronous", () => {
    expect(classifyPaymentMethod("card")).toBe("synchronous")
    expect(classifyPaymentMethod("link")).toBe("synchronous")
    expect(classifyPaymentMethod("apple_pay")).toBe("synchronous")
    expect(classifyPaymentMethod("google_pay")).toBe("synchronous")
  })

  it("classifies MB WAY as short-lived async", () => {
    expect(classifyPaymentMethod("mb_way")).toBe("async_short")
  })

  it("excludes every other Stripe method", () => {
    expect(classifyPaymentMethod("sepa_debit")).toBe("excluded")
    expect(classifyPaymentMethod("klarna")).toBe("excluded")
  })
})
