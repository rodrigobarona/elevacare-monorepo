import { describe, expect, it } from "vitest"
import { bookingReturnUrl, parseRedirectStatus } from "./funnel-return"

describe("parseRedirectStatus", () => {
  it("reads a successful Stripe redirect", () => {
    expect(parseRedirectStatus("?redirect_status=succeeded")).toBe("succeeded")
    expect(parseRedirectStatus("redirect_status=processing")).toBe("processing")
  })

  it("reads a failed Stripe redirect", () => {
    expect(parseRedirectStatus("?redirect_status=failed")).toBe("failed")
  })

  it("ignores other query values", () => {
    expect(parseRedirectStatus("?redirect_status=canceled")).toBeNull()
    expect(parseRedirectStatus("")).toBeNull()
  })
})

describe("bookingReturnUrl", () => {
  it("strips Stripe redirect query keys", () => {
    expect(
      bookingReturnUrl(
        "https://eleva.care/en/ana/intake?redirect_status=succeeded&payment_intent=pi_1&keep=1"
      )
    ).toBe("https://eleva.care/en/ana/intake?keep=1")
  })
})
