import { beforeEach, describe, expect, it, vi } from "vitest"

const cancelBookingByExpert = vi.fn()
const getExpertProfileForOrg = vi.fn()
const requireRevocableApiCapability = vi.fn()
const apiAuthFailure = vi.fn()
const applyRateLimit = vi.fn()

// Hoisted with the mocks below, which need the class.
const { ExpertCancelError } = vi.hoisted(() => ({
  ExpertCancelError: class extends Error {
    constructor(
      readonly code:
        | "not_found"
        | "INVALID_STATUS"
        | "TOO_LATE"
        | "SESSION_CHANGED"
    ) {
      super(code)
    }
  },
}))

vi.mock("@eleva/scheduling", () => ({
  cancelBookingByExpert: (...args: unknown[]) => cancelBookingByExpert(...args),
  ExpertCancelError,
}))

vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: (...args: unknown[]) =>
    getExpertProfileForOrg(...args),
}))

vi.mock("@eleva/observability", () => ({ logError: vi.fn() }))

vi.mock("@/lib/auth", () => ({
  requireRevocableApiCapability: (...args: unknown[]) =>
    requireRevocableApiCapability(...args),
  apiAuthFailure: (...args: unknown[]) => apiAuthFailure(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimit(...args),
  rateLimitKey: () => "cancel",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST } from "./route"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"

function cancel(id: string, body?: unknown) {
  return POST(
    new Request(`http://127.0.0.1:3002/expert/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { params: Promise.resolve({ id }) }
  )
}

describe("POST /expert/bookings/{id}/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRevocableApiCapability.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "org-1",
    })
    apiAuthFailure.mockReturnValue(null)
    applyRateLimit.mockResolvedValue(null)
    getExpertProfileForOrg.mockResolvedValue({
      id: "profile-1",
      orgId: "org-1",
    })
    cancelBookingByExpert.mockResolvedValue({
      refundCents: 6000,
      alreadyCancelled: false,
    })
  })

  it("cancels the caller's own session and says what is refunded", async () => {
    const response = await cancel(BOOKING_ID, { reason: "unavailable" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      bookingId: BOOKING_ID,
      status: "cancelled",
      refundCents: 6000,
      alreadyCancelled: false,
    })
    // A refund is money: only auth that can be revoked is accepted.
    expect(requireRevocableApiCapability).toHaveBeenCalledWith(
      expect.anything(),
      "events:manage"
    )
    // The profile comes from the session, never from the request.
    expect(getExpertProfileForOrg).toHaveBeenCalledWith("user-1", "org-1")
    expect(cancelBookingByExpert).toHaveBeenCalledWith({
      actorUserId: "user-1",
      orgId: "org-1",
      expertProfileId: "profile-1",
      bookingId: BOOKING_ID,
      reason: "unavailable",
      expectedStartsAt: undefined,
    })
  })

  it("passes on the start time the caller saw", async () => {
    await cancel(BOOKING_ID, { expectedStartsAt: "2026-11-30T09:00:00.000Z" })
    expect(cancelBookingByExpert).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStartsAt: new Date("2026-11-30T09:00:00.000Z"),
      })
    )
  })

  it("says so when it was already cancelled", async () => {
    cancelBookingByExpert.mockResolvedValue({
      refundCents: 0,
      alreadyCancelled: true,
    })
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      refundCents: 0,
      alreadyCancelled: true,
    })
  })

  it("stops at sign-in, before anything is read", async () => {
    requireRevocableApiCapability.mockRejectedValue(new Error("unauthorized"))
    apiAuthFailure.mockReturnValue(new Response(null, { status: 401 }))
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(401)
    expect(getExpertProfileForOrg).not.toHaveBeenCalled()
    expect(cancelBookingByExpert).not.toHaveBeenCalled()
  })

  it("stops when the caller is over the rate limit", async () => {
    applyRateLimit.mockResolvedValue(new Response(null, { status: 429 }))
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(429)
    expect(cancelBookingByExpert).not.toHaveBeenCalled()
  })

  it("cancels nothing on a body it cannot read", async () => {
    const response = await POST(
      new Request(
        `http://127.0.0.1:3002/expert/bookings/${BOOKING_ID}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not json",
        }
      ),
      { params: Promise.resolve({ id: BOOKING_ID }) }
    )
    expect(response.status).toBe(400)
    expect(cancelBookingByExpert).not.toHaveBeenCalled()
  })

  it("accepts a call with no body", async () => {
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(200)
    expect(cancelBookingByExpert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: undefined })
    )
  })

  it("refuses an id that is not a booking id", async () => {
    const response = await cancel("not-an-id")
    expect(response.status).toBe(422)
    expect(cancelBookingByExpert).not.toHaveBeenCalled()
  })

  it("refuses a reason that is not on the list (no free text)", async () => {
    const response = await cancel(BOOKING_ID, { reason: "I have the flu" })
    expect(response.status).toBe(400)
    expect(cancelBookingByExpert).not.toHaveBeenCalled()
  })

  it("answers 404 for someone with no expert profile here", async () => {
    getExpertProfileForOrg.mockResolvedValue(null)
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(404)
    expect(cancelBookingByExpert).not.toHaveBeenCalled()
  })

  it("answers 404 for another expert's booking", async () => {
    cancelBookingByExpert.mockRejectedValue(new ExpertCancelError("not_found"))
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(404)
  })

  it("answers 409 with a code when it cannot be cancelled any more", async () => {
    cancelBookingByExpert.mockRejectedValue(new ExpertCancelError("TOO_LATE"))
    const late = await cancel(BOOKING_ID)
    expect(late.status).toBe(409)
    expect(await late.json()).toMatchObject({ error: "TOO_LATE" })

    cancelBookingByExpert.mockRejectedValue(
      new ExpertCancelError("INVALID_STATUS")
    )
    const wrong = await cancel(BOOKING_ID)
    expect(wrong.status).toBe(409)
    expect(await wrong.json()).toMatchObject({ error: "INVALID_STATUS" })

    cancelBookingByExpert.mockRejectedValue(
      new ExpertCancelError("SESSION_CHANGED")
    )
    const moved = await cancel(BOOKING_ID)
    expect(moved.status).toBe(409)
    expect(await moved.json()).toMatchObject({ error: "SESSION_CHANGED" })
  })

  it("answers 500 without detail when something unexpected fails", async () => {
    cancelBookingByExpert.mockRejectedValue(new Error("db down: secret"))
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "internal" })
  })
})
