import { beforeEach, describe, expect, it, vi } from "vitest"

const cancelBookingByExpert = vi.fn()
const getExpertProfileForOrg = vi.fn()
const requireApiCapability = vi.fn()

// Hoisted with the mocks below, which need the class.
const { ExpertCancelError } = vi.hoisted(() => ({
  ExpertCancelError: class extends Error {
    constructor(readonly code: "not_found" | "INVALID_STATUS" | "TOO_LATE") {
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
  requireApiCapability: (...args: unknown[]) => requireApiCapability(...args),
  apiAuthFailure: vi.fn(() => null),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
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
    requireApiCapability.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "org-1",
    })
    getExpertProfileForOrg.mockResolvedValue({
      id: "profile-1",
      orgId: "org-1",
    })
    cancelBookingByExpert.mockResolvedValue({ refundCents: 6000 })
  })

  it("cancels the caller's own session and says what is refunded", async () => {
    const response = await cancel(BOOKING_ID, { reason: "I am unwell" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      bookingId: BOOKING_ID,
      status: "cancelled",
      refundCents: 6000,
    })
    expect(requireApiCapability).toHaveBeenCalledWith(
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
      reason: "I am unwell",
    })
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

  it("refuses a reason longer than 180 characters", async () => {
    const response = await cancel(BOOKING_ID, { reason: "x".repeat(181) })
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
  })

  it("answers 500 without detail when something unexpected fails", async () => {
    cancelBookingByExpert.mockRejectedValue(new Error("db down: secret"))
    const response = await cancel(BOOKING_ID)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "internal" })
  })
})
