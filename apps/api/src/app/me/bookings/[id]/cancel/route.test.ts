import { beforeEach, describe, expect, it, vi } from "vitest"

const cancelMemberBooking = vi.fn()
const requireRevocableMemberApiAuth = vi.fn()
const apiAuthFailure = vi.fn()

vi.mock("@eleva/scheduling", () => ({
  cancelMemberBooking: (...args: unknown[]) => cancelMemberBooking(...args),
  MemberBookingPolicyError: class extends Error {},
}))

vi.mock("@eleva/observability", () => ({ logError: vi.fn() }))

// Only the revocable helper exists in this mock: a route that went back to
// auth accepting a short-lived token would fail to import it.
vi.mock("@/lib/auth", () => ({
  requireRevocableMemberApiAuth: (...args: unknown[]) =>
    requireRevocableMemberApiAuth(...args),
  apiAuthFailure: (...args: unknown[]) => apiAuthFailure(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "cancel",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

vi.mock("@/lib/member-booking-http", () => ({
  MEMBER_BOOKING_POLICY_STATUS: {},
  serializeCancellationQuote: () => ({
    policy: "flexible",
    refundPercent: 100,
    refundCents: 6000,
    currency: "EUR",
    reason: "policy_tier",
    fullRefundUntil: null,
    nextChangeAt: null,
  }),
}))

import { POST } from "./route"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"

function cancel() {
  return POST(
    new Request(`http://127.0.0.1:3002/me/bookings/${BOOKING_ID}/cancel`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: BOOKING_ID }) }
  )
}

describe("POST /me/bookings/{id}/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRevocableMemberApiAuth.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "space-1",
    })
    apiAuthFailure.mockReturnValue(null)
    cancelMemberBooking.mockResolvedValue({ refund: {} })
  })

  it("cancels the member's own booking in their Space", async () => {
    const response = await cancel()
    expect(requireRevocableMemberApiAuth).toHaveBeenCalledOnce()
    expect(cancelMemberBooking).toHaveBeenCalledWith({
      userId: "user-1",
      orgId: "space-1",
      bookingId: BOOKING_ID,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      bookingId: BOOKING_ID,
      refund: { refundPercent: 100, refundCents: 6000 },
    })
  })

  it("refuses a short-lived token before anything is done: it can refund", async () => {
    requireRevocableMemberApiAuth.mockRejectedValue(
      new Error("jwt-not-revocable")
    )
    apiAuthFailure.mockReturnValue(new Response(null, { status: 403 }))
    const response = await cancel()
    expect(response.status).toBe(403)
    expect(cancelMemberBooking).not.toHaveBeenCalled()
  })
})
