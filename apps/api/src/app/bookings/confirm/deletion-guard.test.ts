import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"

const confirmBookingPayment = vi.fn()

vi.mock("@eleva/scheduling", () => ({
  confirmBookingPayment: (...args: unknown[]) => confirmBookingPayment(...args),
}))

vi.mock("@eleva/billing/server", () => ({
  retrieveBookingPaymentIntent: vi.fn(),
}))

vi.mock("@eleva/workflows/domain-events", () => ({
  publishPendingDomainEvents: vi.fn(async () => undefined),
}))

vi.mock("@eleva/workflows/subscribers", () => ({
  defaultDomainEventSubscribers: () => [],
}))

vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn()
  },
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
  rateLimitKey: () => "confirm-deletion",
  RATE_LIMITS: { public: { prefix: "pub", maxRequests: 10, windowMs: 60_000 } },
}))

import { POST } from "./route"

describe("POST /bookings/confirm deletion race", () => {
  it("still returns 201 for a succeeded PaymentIntent", async () => {
    confirmBookingPayment.mockResolvedValue({
      ok: true,
      bookingId: "00000000-0000-4000-8000-000000000099",
      alreadyConfirmed: false,
    })

    const response = await POST(
      new Request("http://127.0.0.1:3002/bookings/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId: "00000000-0000-4000-8000-000000000022",
          reservationToken: "reservation-token-16xx",
          paymentIntentId: "pi_succeeded",
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(confirmBookingPayment).toHaveBeenCalled()
  })

  it("does not import assertMemberCanBook", async () => {
    const src = await readFile(new URL("./route.ts", import.meta.url), "utf8")
    expect(src).not.toContain("assertMemberCanBook")
  })
})
