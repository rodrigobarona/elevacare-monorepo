import { describe, expect, it, vi } from "vitest"

const reserveBooking = vi.fn()
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

vi.mock("@eleva/scheduling", () => ({
  reserveBooking: (...args: unknown[]) => reserveBooking(...args),
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
  rateLimitKey: () => "reserve-deletion",
  RATE_LIMITS: { public: { prefix: "pub", maxRequests: 10, windowMs: 60_000 } },
}))

vi.mock("@/lib/booking-redis", () => ({
  getBookingRedis: () => ({ set: vi.fn() }),
}))

import { POST } from "./route"

const MODE_ID = "00000000-0000-4000-8000-000000000021"

function reserveRequest() {
  return new Request("http://127.0.0.1:3002/bookings/reserve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "anaquick",
      eventTypeModeId: MODE_ID,
      startsAt: "2026-09-20T10:00:00.000Z",
      endsAt: "2026-09-20T11:00:00.000Z",
      timezone: "Europe/Lisbon",
      language: "en",
      memberCountry: "PT",
      consents: [
        { kind: "terms", version: "working" },
        { kind: "privacy", version: "working" },
        { kind: "health_data_processing", version: "working" },
      ],
    }),
  })
}

describe("POST /bookings/reserve member bookability", () => {
  it("returns 409 when deletion is scheduled", async () => {
    assertMemberCanBook.mockRejectedValue(
      new BookingError("ACCOUNT_DELETION_SCHEDULED")
    )
    const response = await POST(reserveRequest())
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: "ACCOUNT_DELETION_SCHEDULED",
    })
    expect(reserveBooking).not.toHaveBeenCalled()
  })

  it("reserves after deletion is cancelled", async () => {
    assertMemberCanBook.mockResolvedValue(undefined)
    reserveBooking.mockResolvedValue({
      ok: true,
      reservationId: "00000000-0000-4000-8000-000000000022",
      reservationToken: "reservation-token-16xx",
      expiresAt: new Date("2026-09-20T10:05:00.000Z"),
    })
    const response = await POST(reserveRequest())
    expect(response.status).toBe(201)
    expect(reserveBooking).toHaveBeenCalled()
  })
})
