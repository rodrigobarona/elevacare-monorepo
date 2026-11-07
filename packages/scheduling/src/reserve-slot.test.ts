import type { Redis } from "@upstash/redis"
import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/audit", () => ({ withAudit: vi.fn() }))
vi.mock("@eleva/db/context", () => ({ withOrgContext: vi.fn() }))

import { acquireSlotLock } from "./reserve-slot"

/** Just enough Redis for SET NX, GET and the compare-and-delete script. */
function fakeRedis(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const redis = {
    set: vi.fn(async (key: string, value: string, opts: { nx?: boolean }) => {
      if (opts.nx && store.has(key)) return null
      store.set(key, value)
      return "OK"
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    eval: vi.fn(async (_script: string, [key]: string[], [value]: string[]) => {
      if (store.get(key!) !== value) return 0
      store.delete(key!)
      return 1
    }),
  }
  return { redis: redis as unknown as Redis, store }
}

const KEY = "slot:exp-1:2026-11-13T09:30:00.000Z"

describe("acquireSlotLock", () => {
  it("takes a free slot without asking the database", async () => {
    const { redis, store } = fakeRedis()
    const holdIsActive = vi.fn()
    expect(await acquireSlotLock(redis, KEY, "new", 300, holdIsActive)).toBe(
      true
    )
    expect(store.get(KEY)).toBe("new")
    expect(holdIsActive).not.toHaveBeenCalled()
  })

  it("refuses while another hold is still active", async () => {
    const { redis, store } = fakeRedis({ [KEY]: "other" })
    const holdIsActive = vi.fn(async () => true)
    expect(await acquireSlotLock(redis, KEY, "new", 300, holdIsActive)).toBe(
      false
    )
    expect(holdIsActive).toHaveBeenCalledWith("other")
    expect(store.get(KEY)).toBe("other")
  })

  it("replaces a lock whose hold already ended (paid, cancelled, released)", async () => {
    const { redis, store } = fakeRedis({ [KEY]: "ended" })
    expect(
      await acquireSlotLock(redis, KEY, "new", 300, async () => false)
    ).toBe(true)
    expect(store.get(KEY)).toBe("new")
  })

  it("keeps the lock when the database check fails", async () => {
    const { redis, store } = fakeRedis({ [KEY]: "unknown" })
    const holdIsActive = vi.fn(async () => {
      throw new Error("db down")
    })
    expect(await acquireSlotLock(redis, KEY, "new", 300, holdIsActive)).toBe(
      false
    )
    expect(store.get(KEY)).toBe("unknown")
  })

  it("does not delete a lock someone else took in the meantime", async () => {
    const { redis, store } = fakeRedis({ [KEY]: "ended" })
    const holdIsActive = vi.fn(async () => {
      // Another request clears the stale lock and takes the slot first.
      store.set(KEY, "winner")
      return false
    })
    expect(await acquireSlotLock(redis, KEY, "new", 300, holdIsActive)).toBe(
      false
    )
    expect(store.get(KEY)).toBe("winner")
  })
})
