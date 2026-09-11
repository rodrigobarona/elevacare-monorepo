import { describe, expect, it, vi } from "vitest"

const createPaymentIntentForReservation = vi.fn()
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
  createPaymentIntentForReservation: (...args: unknown[]) =>
    createPaymentIntentForReservation(...args),
}))

vi.mock("@eleva/scheduling", () => ({
  assertMemberCanBook: (...args: unknown[]) => assertMemberCanBook(...args),
  BookingError,
}))

vi.mock("@/lib/auth", () => ({
  resolveApiAuth: vi.fn(async () => ({
    type: "session",
    session: {
      user: { id: "user-1", email: "ada@eleva.care" },
      orgId: "org-1",
    },
  })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/bot-protection", () => ({
  checkBot: vi.fn(async () => null),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "intent-deletion",
  RATE_LIMITS: { public: { prefix: "pub", maxRequests: 10, windowMs: 60_000 } },
}))

import { POST } from "./route"

function intentRequest() {
  return new Request("http://127.0.0.1:3002/payments/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reservationId: "00000000-0000-4000-8000-000000000022",
      reservationToken: "reservation-token-16xx",
    }),
  })
}

describe("POST /payments/intent member bookability", () => {
  it("returns 409 when deletion is scheduled", async () => {
    assertMemberCanBook.mockRejectedValue(
      new BookingError("ACCOUNT_DELETION_SCHEDULED")
    )
    const response = await POST(intentRequest())
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: "ACCOUNT_DELETION_SCHEDULED",
    })
    expect(createPaymentIntentForReservation).not.toHaveBeenCalled()
  })
})
