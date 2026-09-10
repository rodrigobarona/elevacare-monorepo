import { describe, expect, it, vi } from "vitest"

const reserveBooking = vi.fn()

vi.mock("@eleva/scheduling", () => ({
  reserveBooking: (...args: unknown[]) => reserveBooking(...args),
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
  rateLimitKey: () => "reserve-concurrency",
  RATE_LIMITS: { public: { prefix: "pub", maxRequests: 10, windowMs: 60_000 } },
}))

vi.mock("@/lib/booking-redis", () => ({
  getBookingRedis: () => ({ set: vi.fn() }),
}))

import { POST } from "./route"

const MODE_ID = "00000000-0000-4000-8000-000000000021"
const START = "2026-06-15T10:00:00.000Z"
const END = "2026-06-15T11:00:00.000Z"

function reserveRequest() {
  return new Request("http://127.0.0.1:3002/bookings/reserve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "anaquick",
      eventTypeModeId: MODE_ID,
      startsAt: START,
      endsAt: END,
      timezone: "Europe/Lisbon",
      language: "en",
      memberCountry: "PT",
      guest: { email: "member@example.com", name: "E2E Member" },
      consents: [
        { kind: "terms", version: "working" },
        { kind: "privacy", version: "working" },
        { kind: "health_data_processing", version: "working" },
      ],
    }),
  })
}

describe("POST /bookings/reserve concurrency", () => {
  it("returns one 201 and ninety-nine 409s for 100 parallel holds", async () => {
    // Live 100-way is blocked by RATE_LIMITS.public (10/min) + BotID.
    // This asserts the HTTP contract. Redis SET NX and 23P01 races live in
    // packages/scheduling/tests/reserve-slot-concurrency.test.ts.
    reserveBooking.mockReset()
    let claimed = false
    reserveBooking.mockImplementation(async () => {
      if (claimed) return { ok: false, error: "SLOT_TAKEN" }
      claimed = true
      return {
        ok: true,
        reservationId: "00000000-0000-4000-8000-000000000022",
        reservationToken: "reservation-token-concurrency",
        expiresAt: new Date("2026-06-15T10:05:00.000Z"),
      }
    })

    const responses = await Promise.all(
      Array.from({ length: 100 }, () => POST(reserveRequest()))
    )
    const statuses = responses.map((response) => response.status)
    const created = statuses.filter((status) => status === 201)
    const taken = statuses.filter((status) => status === 409)

    expect(created).toHaveLength(1)
    expect(taken).toHaveLength(99)
    expect(reserveBooking).toHaveBeenCalledTimes(100)
  })
})
