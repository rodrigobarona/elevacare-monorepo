import type { Redis } from "@upstash/redis"
import { describe, expect, it, vi } from "vitest"
import { withIdempotency, type IdempotencyContext } from "./idempotency"

vi.mock("./booking-redis", () => ({ getBookingRedis: () => null }))

function memoryRedis() {
  const store = new Map<string, unknown>()
  const redis = {
    async set(
      key: string,
      value: unknown,
      options?: { nx?: boolean; ex?: number }
    ) {
      if (options?.nx && store.has(key)) return null
      store.set(key, value)
      return "OK"
    },
    async get(key: string) {
      return store.get(key) ?? null
    },
    async del(key: string) {
      store.delete(key)
      return 1
    },
  }
  return { redis: redis as unknown as Redis, store }
}

const CONTEXT: IdempotencyContext = {
  scope: "bookings.reserve",
  actor: "ip:203.0.113.7",
  headers: { "Access-Control-Allow-Origin": "https://eleva.care" },
}

function post(body: unknown, key?: string): Request {
  return new Request("https://api.eleva.care/bookings/reserve", {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : {},
    body: JSON.stringify(body),
  })
}

const created = () => Response.json({ reservationId: "r1" }, { status: 201 })

describe("withIdempotency", () => {
  it("runs normally without the header", async () => {
    const { redis, store } = memoryRedis()
    const run = vi.fn(async () => created())
    const response = await withIdempotency(post({ a: 1 }), CONTEXT, run, redis)
    expect(response.status).toBe(201)
    expect(run).toHaveBeenCalledTimes(1)
    expect(store.size).toBe(0)
  })

  it("rejects malformed keys with 422", async () => {
    const { redis } = memoryRedis()
    const run = vi.fn(async () => created())
    const response = await withIdempotency(
      post({ a: 1 }, "short"),
      CONTEXT,
      run,
      redis
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      code: "IDEMPOTENCY_KEY_INVALID",
    })
    expect(run).not.toHaveBeenCalled()
  })

  it("replays a finished 2xx result for the same key and body", async () => {
    const { redis } = memoryRedis()
    const run = vi.fn(async () => created())
    const first = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      run,
      redis
    )
    const second = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      run,
      redis
    )
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.headers.get("Idempotent-Replayed")).toBe("true")
    expect(second.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://eleva.care"
    )
    expect(await second.json()).toEqual({ reservationId: "r1" })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("rejects the same key with a different body", async () => {
    const { redis } = memoryRedis()
    const run = vi.fn(async () => created())
    await withIdempotency(post({ a: 1 }, "key-12345678"), CONTEXT, run, redis)
    const response = await withIdempotency(
      post({ a: 2 }, "key-12345678"),
      CONTEXT,
      run,
      redis
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
    })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("returns 409 for an in-flight duplicate", async () => {
    const { redis } = memoryRedis()
    let release: (response: Response) => void = () => {}
    const slow = vi.fn(
      () => new Promise<Response>((resolve) => (release = resolve))
    )
    const first = withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      slow,
      redis
    )
    await vi.waitFor(() => expect(slow).toHaveBeenCalled())
    const duplicate = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      vi.fn(),
      redis
    )
    expect(duplicate.status).toBe(409)
    expect(duplicate.headers.get("Retry-After")).toBe("1")
    release(created())
    expect((await first).status).toBe(201)
  })

  it("scopes keys per actor", async () => {
    const { redis } = memoryRedis()
    const run = vi.fn(async () => created())
    await withIdempotency(post({ a: 1 }, "key-12345678"), CONTEXT, run, redis)
    await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      { ...CONTEXT, actor: "user:other" },
      run,
      redis
    )
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("releases the key after a non-2xx result or a throw so callers can retry", async () => {
    const { redis, store } = memoryRedis()
    const failing = vi.fn(async () =>
      Response.json({ error: "SLOT_TAKEN" }, { status: 409 })
    )
    await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      failing,
      redis
    )
    expect(store.size).toBe(0)

    const throwing = vi.fn(async () => {
      throw new Error("boom")
    })
    await expect(
      withIdempotency(post({ a: 1 }, "key-12345678"), CONTEXT, throwing, redis)
    ).rejects.toThrow("boom")
    expect(store.size).toBe(0)

    const ok = vi.fn(async () => created())
    const retry = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      ok,
      redis
    )
    expect(retry.status).toBe(201)
    expect(retry.headers.get("Idempotent-Replayed")).toBeNull()
  })

  it("runs without idempotency when Redis is unavailable", async () => {
    const run = vi.fn(async () => created())
    const response = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      run,
      null
    )
    expect(response.status).toBe(201)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("runs without idempotency when the claim fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { redis } = memoryRedis()
    redis.set = vi.fn().mockRejectedValue(new Error("redis down"))
    const run = vi.fn(async () => created())
    const response = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      run,
      redis
    )
    expect(response.status).toBe(201)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("still returns a committed success when persisting the result fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { redis } = memoryRedis()
    const set = redis.set.bind(redis) as typeof redis.set
    let calls = 0
    redis.set = vi.fn(async (...args: Parameters<typeof redis.set>) => {
      calls += 1
      if (calls > 1) throw new Error("redis down")
      return set(...args)
    }) as typeof redis.set
    const response = await withIdempotency(
      post({ a: 1 }, "key-12345678"),
      CONTEXT,
      async () => created(),
      redis
    )
    expect(response.status).toBe(201)
  })

  it("rethrows the handler error even if releasing the key fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { redis } = memoryRedis()
    redis.del = vi.fn().mockRejectedValue(new Error("redis down"))
    await expect(
      withIdempotency(
        post({ a: 1 }, "key-12345678"),
        CONTEXT,
        async () => {
          throw new Error("handler")
        },
        redis
      )
    ).rejects.toThrow("handler")
  })
})
