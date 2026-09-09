import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Redis } from "@upstash/redis"

vi.mock("@eleva/db/context", () => {
  const exclusion = Object.assign(new Error("conflicting key value"), {
    code: "23P01",
  })
  const mockTx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.reject(exclusion),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  }

  return {
    withOrgContext: vi.fn(
      async (_orgId: string, fn: (tx: typeof mockTx) => Promise<unknown>) => {
        return fn(mockTx)
      }
    ),
  }
})

vi.mock("@eleva/db/schema", () => ({
  slotReservations: { id: "id" },
  bookings: { id: "id" },
  sessions: { id: "id" },
}))

function createMockRedis(): Redis {
  return {
    set: vi.fn(async () => "OK"),
    eval: vi.fn(async () => 1),
  } as unknown as Redis
}

describe("reserveSlot — exclusion constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps PostgreSQL 23P01 to conflict", async () => {
    const { reserveSlot } = await import("../src/reserve-slot")
    const result = await reserveSlot(createMockRedis(), {
      eventTypeId: "evt-type-1",
      expertProfileId: "expert-1",
      expertUserId: "user-1",
      orgId: "org-1",
      startsAt: new Date("2026-06-15T10:00:00Z"),
      endsAt: new Date("2026-06-15T11:00:00Z"),
      holdToken: "token-1",
      ttlSeconds: 300,
    })

    expect(result).toEqual({ success: false, error: "conflict" })
  })
})
