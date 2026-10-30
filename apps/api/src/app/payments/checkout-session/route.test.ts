import { beforeEach, describe, expect, it, vi } from "vitest"

const createCheckoutSessionForReservation = vi.fn()
const assertMemberCanBook = vi.fn()

const { BookingError } = vi.hoisted(() => {
  class BookingError extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.name = "BookingError"
      this.code = code
    }
  }
  return { BookingError }
})

vi.mock("@eleva/billing/server", () => ({
  createCheckoutSessionForReservation: (...args: unknown[]) =>
    createCheckoutSessionForReservation(...args),
}))

vi.mock("@eleva/scheduling", () => ({
  assertMemberCanBook: (...args: unknown[]) => assertMemberCanBook(...args),
  BookingError,
}))

vi.mock("@/lib/auth", () => ({
  resolveApiAuth: vi.fn(async () => ({ type: "anonymous" })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/bot-protection", () => ({
  checkBot: vi.fn(async () => null),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "checkout-session",
  RATE_LIMITS: { public: { prefix: "pub", maxRequests: 10, windowMs: 60_000 } },
}))

import { POST } from "./route"

const reservationId = "00000000-0000-4000-8000-000000000022"

function sessionRequest(
  body: Record<string, unknown>,
  origin = "https://dev.eleva.care"
) {
  return new Request("https://api.eleva.care/payments/checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      reservationId,
      reservationToken: "reservation-token-16xx",
      ...body,
    }),
  })
}

describe("POST /payments/checkout-session", () => {
  beforeEach(() => {
    createCheckoutSessionForReservation.mockReset()
    createCheckoutSessionForReservation.mockResolvedValue({
      ok: true,
      clientSecret: "cs_test_secret",
      checkoutSessionId: "cs_test_1",
      bookingId: "00000000-0000-4000-8000-000000000033",
      publishableKey: "pk_test_1",
    })
  })

  it("returns the session and builds the return URL on the funnel origin", async () => {
    const response = await POST(
      sessionRequest({ returnPath: "/fisiomota/first-visit?step=pay" })
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      clientSecret: "cs_test_secret",
      checkoutSessionId: "cs_test_1",
    })
    expect(createCheckoutSessionForReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId,
        returnUrl: "https://dev.eleva.care/fisiomota/first-visit?step=pay",
      })
    )
  })

  it("keeps Stripe's {CHECKOUT_SESSION_ID} template literal", async () => {
    await POST(
      sessionRequest({
        returnPath:
          "/fisiomota/first-visit?checkout_session_id={CHECKOUT_SESSION_ID}",
      })
    )
    expect(createCheckoutSessionForReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl:
          "https://dev.eleva.care/fisiomota/first-visit?checkout_session_id={CHECKOUT_SESSION_ID}",
      })
    )
  })

  it("rejects an absolute or protocol-relative return path", async () => {
    for (const returnPath of ["https://evil.example/x", "//evil.example/x"]) {
      const response = await POST(sessionRequest({ returnPath }))
      expect(response.status).toBe(422)
    }
    expect(createCheckoutSessionForReservation).not.toHaveBeenCalled()
  })

  it("ignores an origin that is not an Eleva origin", async () => {
    await POST(
      sessionRequest({ returnPath: "/fisiomota" }, "https://evil.example")
    )
    const call = createCheckoutSessionForReservation.mock.calls[0]?.[0] as {
      returnUrl: string
    }
    expect(new URL(call.returnUrl).hostname).not.toBe("evil.example")
  })

  it("maps a missing reservation to the public 404", async () => {
    createCheckoutSessionForReservation.mockResolvedValue({
      ok: false,
      error: "not_found",
    })
    const response = await POST(sessionRequest({ returnPath: "/fisiomota" }))
    expect(response.status).toBe(404)
  })
})
