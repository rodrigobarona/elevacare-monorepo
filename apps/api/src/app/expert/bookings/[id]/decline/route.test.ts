import { beforeEach, describe, expect, it, vi } from "vitest"

const declineBookingRequest = vi.fn()
const getExpertProfileForOrg = vi.fn()
const requireRevocableApiCapability = vi.fn()
const apiAuthFailure = vi.fn()

vi.mock("@eleva/scheduling", () => ({
  declineBookingRequest: (...args: unknown[]) => declineBookingRequest(...args),
  BookingRequestError: class extends Error {},
}))

vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: (...args: unknown[]) =>
    getExpertProfileForOrg(...args),
}))

vi.mock("@eleva/observability", () => ({ logError: vi.fn() }))

// Only the revocable helper exists in this mock: a route that went back to
// auth accepting a short-lived token would fail to import it.
vi.mock("@/lib/auth", () => ({
  requireRevocableApiCapability: (...args: unknown[]) =>
    requireRevocableApiCapability(...args),
  apiAuthFailure: (...args: unknown[]) => apiAuthFailure(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "decline",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST } from "./route"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"

function decline(body?: unknown) {
  return POST(
    new Request(`http://127.0.0.1:3002/expert/bookings/${BOOKING_ID}/decline`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { params: Promise.resolve({ id: BOOKING_ID }) }
  )
}

describe("POST /expert/bookings/{id}/decline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRevocableApiCapability.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "org-1",
    })
    apiAuthFailure.mockReturnValue(null)
    getExpertProfileForOrg.mockResolvedValue({
      id: "profile-1",
      orgId: "org-1",
    })
    declineBookingRequest.mockResolvedValue({ refundCents: 6000 })
  })

  it("declines with a reason from the list", async () => {
    const response = await decline({ reason: "unavailable" })
    expect(response.status).toBe(200)
    expect(requireRevocableApiCapability).toHaveBeenCalledWith(
      expect.anything(),
      "events:manage"
    )
    expect(declineBookingRequest).toHaveBeenCalledWith({
      actorUserId: "user-1",
      orgId: "org-1",
      expertProfileId: "profile-1",
      bookingId: BOOKING_ID,
      reason: "unavailable",
      source: "expert",
    })
  })

  it("refuses a short-lived token before anything is read: it refunds", async () => {
    requireRevocableApiCapability.mockRejectedValue(
      new Error("jwt-not-revocable")
    )
    apiAuthFailure.mockReturnValue(new Response(null, { status: 403 }))
    const response = await decline({})
    expect(response.status).toBe(403)
    expect(getExpertProfileForOrg).not.toHaveBeenCalled()
    expect(declineBookingRequest).not.toHaveBeenCalled()
  })

  it("refuses a reason that is not on the list (no free text)", async () => {
    const response = await decline({ reason: "Not right for your back pain" })
    expect(response.status).toBe(400)
    expect(declineBookingRequest).not.toHaveBeenCalled()
  })

  it("ignores a note from an older client rather than storing it", async () => {
    const response = await decline({ note: "typed words" })
    expect(response.status).toBe(200)
    expect(declineBookingRequest).toHaveBeenCalledWith(
      expect.objectContaining({ reason: undefined })
    )
    expect(
      Object.keys(declineBookingRequest.mock.calls[0]?.[0] as object)
    ).not.toContain("note")
  })
})
