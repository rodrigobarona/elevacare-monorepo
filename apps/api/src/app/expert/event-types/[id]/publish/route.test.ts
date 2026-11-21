import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class SeatLimitReachedError extends Error {
    constructor(
      readonly cap: number,
      readonly plan: string
    ) {
      super("SEAT_LIMIT_REACHED")
    }
  }
  class ConnectIncompleteError extends Error {}
  return {
    SeatLimitReachedError,
    ConnectIncompleteError,
    calls: [] as string[],
    assertSeatAvailable: vi.fn(),
    updateEventType: vi.fn(),
    markSeatSyncPending: vi.fn(),
    enqueueSeatSync: vi.fn(),
    emit: vi.fn(),
  }
})

const TX = { marker: "tx" }
const PROFILE = {
  id: "profile-1",
  orgId: "clinic-1",
  username: "anamota",
  worldwideRemote: true,
  serviceCountries: [],
  languages: ["pt"],
  stripeIdentityStatus: null,
}

vi.mock("@eleva/observability", () => ({ logError: vi.fn() }))
vi.mock("@eleva/flags", () => ({ getFlag: vi.fn(async () => false) }))
vi.mock("@eleva/scheduling", () => ({
  publishEventType: () => ({ ok: true, violations: [] }),
}))
vi.mock("@eleva/audit", () => ({
  // The route's writes run inside this one transaction.
  withAudit: async (
    _options: unknown,
    fn: (tx: unknown, ctx: { emit: typeof mocks.emit }) => Promise<unknown>
  ) => fn(TX, { emit: mocks.emit }),
}))
vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: vi.fn(async () => PROFILE),
  getEventType: vi.fn(async () => ({ id: "service-1" })),
  lockEventTypeForUpdate: vi.fn(async () => ({
    id: "service-1",
    kind: "non_clinical",
    priceAmount: 0,
  })),
  listEventTypeModesWithLocation: vi.fn(async () => []),
  updateEventType: (...args: unknown[]) => {
    mocks.calls.push("write")
    return mocks.updateEventType(...args)
  },
}))
vi.mock("@eleva/billing/server", () => ({
  SeatLimitReachedError: mocks.SeatLimitReachedError,
  ConnectIncompleteError: mocks.ConnectIncompleteError,
  assertConnectReadyForPayments: vi.fn(),
  offerTakesPayment: () => false,
  assertSeatAvailable: (...args: unknown[]) => {
    mocks.calls.push("seat-check")
    return mocks.assertSeatAvailable(...args)
  },
  markSeatSyncPending: (...args: unknown[]) =>
    mocks.markSeatSyncPending(...args),
  enqueueSeatSync: (...args: unknown[]) => mocks.enqueueSeatSync(...args),
}))
vi.mock("@/lib/auth", () => ({
  requireApiCapability: vi.fn(async () => ({
    user: { id: "user-1" },
    orgId: "clinic-1",
  })),
  apiAuthFailure: () => null,
}))
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "publish",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST } from "./route"

function publish() {
  return POST(
    new Request("http://127.0.0.1:3002/expert/event-types/service-1/publish", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "service-1" }) }
  )
}

describe("POST /expert/event-types/{id}/publish — clinic seats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.calls.length = 0
  })

  it("checks for a seat inside the publish transaction, before the write", async () => {
    const res = await publish()
    expect(res.status).toBe(200)
    expect(mocks.calls).toEqual(["seat-check", "write"])
    // Same transaction as the write, for the member who is publishing.
    expect(mocks.assertSeatAvailable).toHaveBeenCalledWith(TX, {
      orgId: "clinic-1",
      userId: "user-1",
    })
    expect(mocks.updateEventType.mock.calls[0]?.[4]).toBe(TX)
    expect(mocks.markSeatSyncPending).toHaveBeenCalledWith("clinic-1", TX)
    expect(mocks.enqueueSeatSync).toHaveBeenCalledWith("clinic-1", "user-1")
  })

  it("answers 409 with the cap and the plan, and publishes nothing", async () => {
    mocks.assertSeatAvailable.mockRejectedValue(
      new mocks.SeatLimitReachedError(5, "clinic_starter")
    )
    const res = await publish()
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      error: "SEAT_LIMIT_REACHED",
      code: "SEAT_LIMIT_REACHED",
      cap: 5,
      plan: "clinic_starter",
    })
    expect(mocks.updateEventType).not.toHaveBeenCalled()
    expect(mocks.emit).not.toHaveBeenCalled()
    // Nothing changed, so nothing is synced to Stripe.
    expect(mocks.enqueueSeatSync).not.toHaveBeenCalled()
  })
})
