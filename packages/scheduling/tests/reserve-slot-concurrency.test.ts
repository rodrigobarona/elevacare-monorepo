import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Redis } from "@upstash/redis"
import type { ReserveSlotResult } from "../src/types"

/**
 * Mock @eleva/db/context — withOrgContext simply executes the callback
 * with a mock transaction that reports no conflicts and returns a
 * generated reservation ID.
 */
vi.mock("@eleva/db/context", () => {
  let insertCounter = 0

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
        returning: () => {
          insertCounter += 1
          return Promise.resolve([{ id: `reservation-${insertCounter}` }])
        },
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
  slotReservations: {
    id: "id",
    orgId: "org_id",
    eventTypeId: "event_type_id",
    expertProfileId: "expert_profile_id",
    startsAt: "starts_at",
    endsAt: "ends_at",
    expiresAt: "expires_at",
    holdToken: "hold_token",
    status: "status",
  },
  bookings: {
    id: "id",
    expertProfileId: "expert_profile_id",
    startsAt: "starts_at",
    endsAt: "ends_at",
    status: "status",
  },
  sessions: {
    id: "id",
    expertProfileId: "expert_profile_id",
    startsAt: "starts_at",
    endsAt: "ends_at",
    status: "status",
  },
}))

/**
 * In-memory Redis mock that faithfully implements SET NX semantics.
 * The store is a plain Map; since JS is single-threaded, the
 * check-and-set inside `set()` is atomic relative to Promise.all
 * interleaving at await points.
 */
function createMockRedis(): Redis {
  const store = new Map<string, string>()
  const deleted = new Set<string>()

  return {
    set: vi.fn(
      async (
        key: string,
        value: unknown,
        opts?: { nx?: boolean; ex?: number }
      ) => {
        if (opts?.nx && store.has(key)) {
          return null
        }
        store.set(key, String(value))
        return "OK"
      }
    ),
    del: vi.fn(async (key: string) => {
      store.delete(key)
      deleted.add(key)
      return 1
    }),
    get store() {
      return store
    },
  } as unknown as Redis
}

describe("reserveSlot — concurrent reservation race", () => {
  let redis: Redis

  beforeEach(() => {
    redis = createMockRedis()
    vi.clearAllMocks()
  })

  it("100 concurrent reservation attempts produce exactly one winner", async () => {
    const { reserveSlot } = await import("../src/reserve-slot")

    const CONCURRENCY = 100
    const slotStart = new Date("2026-06-15T10:00:00Z")
    const slotEnd = new Date("2026-06-15T11:00:00Z")

    const attempts = Array.from({ length: CONCURRENCY }, (_, i) =>
      reserveSlot(redis, {
        eventTypeId: "evt-type-1",
        expertProfileId: "expert-1",
        orgId: "org-1",
        startsAt: slotStart,
        endsAt: slotEnd,
        holdToken: `token-${i}`,
        ttlSeconds: 300,
      })
    )

    const results: ReserveSlotResult[] = await Promise.all(attempts)

    const winners = results.filter((r) => r.success)
    const losers = results.filter((r) => !r.success)

    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(CONCURRENCY - 1)

    expect(winners[0]!.reservationId).toBeDefined()
    expect(winners[0]!.reservationId).toMatch(/^reservation-/)

    for (const loser of losers) {
      expect(loser.error).toBe("slot_taken")
    }

    expect(redis.set).toHaveBeenCalledTimes(CONCURRENCY)
  })

  it("different slots can be reserved concurrently by the same expert", async () => {
    const { reserveSlot } = await import("../src/reserve-slot")

    const slot1 = reserveSlot(redis, {
      eventTypeId: "evt-type-1",
      expertProfileId: "expert-1",
      orgId: "org-1",
      startsAt: new Date("2026-06-15T10:00:00Z"),
      endsAt: new Date("2026-06-15T11:00:00Z"),
      holdToken: "token-a",
      ttlSeconds: 300,
    })

    const slot2 = reserveSlot(redis, {
      eventTypeId: "evt-type-1",
      expertProfileId: "expert-1",
      orgId: "org-1",
      startsAt: new Date("2026-06-15T14:00:00Z"),
      endsAt: new Date("2026-06-15T15:00:00Z"),
      holdToken: "token-b",
      ttlSeconds: 300,
    })

    const [r1, r2] = await Promise.all([slot1, slot2])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r1.reservationId).not.toBe(r2.reservationId)
  })

  it("different experts can reserve the same time concurrently", async () => {
    const { reserveSlot } = await import("../src/reserve-slot")

    const slotStart = new Date("2026-06-15T10:00:00Z")
    const slotEnd = new Date("2026-06-15T11:00:00Z")

    const expert1 = reserveSlot(redis, {
      eventTypeId: "evt-type-1",
      expertProfileId: "expert-1",
      orgId: "org-1",
      startsAt: slotStart,
      endsAt: slotEnd,
      holdToken: "token-a",
      ttlSeconds: 300,
    })

    const expert2 = reserveSlot(redis, {
      eventTypeId: "evt-type-1",
      expertProfileId: "expert-2",
      orgId: "org-1",
      startsAt: slotStart,
      endsAt: slotEnd,
      holdToken: "token-b",
      ttlSeconds: 300,
    })

    const [r1, r2] = await Promise.all([expert1, expert2])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
  })
})
