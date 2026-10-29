import { afterEach, describe, expect, it, vi } from "vitest"
import {
  AUTH_IP_ADDRESS_HEADERS,
  asStorageString,
  createSecondaryStorage,
  incrementWithTtl,
} from "./secondary-storage"

afterEach(() => {
  vi.unstubAllEnvs()
})

function kvEnv(url: string, token: string): NodeJS.ProcessEnv {
  return { ...process.env, KV_REST_API_URL: url, KV_REST_API_TOKEN: token }
}

describe("asStorageString", () => {
  it("returns null for nullish", () => {
    expect(asStorageString(null)).toBeNull()
    expect(asStorageString(undefined)).toBeNull()
  })

  it("passes strings through", () => {
    expect(asStorageString("1")).toBe("1")
  })

  it("JSON-stringifies objects Upstash may auto-parse", () => {
    expect(asStorageString({ a: 1 })).toBe('{"a":1}')
  })
})

describe("AUTH_IP_ADDRESS_HEADERS", () => {
  it("prefers Vercel single-value headers before x-forwarded-for", () => {
    expect([...AUTH_IP_ADDRESS_HEADERS]).toEqual([
      "x-vercel-forwarded-for",
      "x-real-ip",
      "x-forwarded-for",
    ])
  })
})

describe("incrementWithTtl", () => {
  it("rejects non-positive TTL", async () => {
    const redis = { pipeline: vi.fn() }
    await expect(incrementWithTtl(redis, "k", 0)).rejects.toThrow(
      /positive integer/
    )
    await expect(incrementWithTtl(redis, "k", 1.5)).rejects.toThrow(
      /positive integer/
    )
    expect(redis.pipeline).not.toHaveBeenCalled()
  })

  it("pipelines INCR then EXPIRE NX and returns the count", async () => {
    const expire = vi.fn()
    const incr = vi.fn()
    const exec = vi.fn().mockResolvedValue([2, 0])
    const redis = {
      pipeline: vi.fn(() => ({ incr, expire, exec })),
    }

    const count = await incrementWithTtl(redis, "ip|/sign-in/social", 10)

    expect(count).toBe(2)
    expect(incr).toHaveBeenCalledWith("ip|/sign-in/social")
    expect(expire).toHaveBeenCalledWith("ip|/sign-in/social", 10, "NX")
    expect(exec).toHaveBeenCalledOnce()
  })

  it("throws when INCR does not return a number", async () => {
    const redis = {
      pipeline: vi.fn(() => ({
        incr: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn().mockResolvedValue([null, 1]),
      })),
    }
    await expect(incrementWithTtl(redis, "k", 10)).rejects.toThrow(/non-number/)
  })
})

describe("createSecondaryStorage", () => {
  it("returns undefined when KV env is missing", () => {
    expect(createSecondaryStorage(kvEnv("", ""))).toBeUndefined()
  })

  it("returns a storage object when KV env is set", () => {
    const storage = createSecondaryStorage(
      kvEnv("https://example.upstash.io", "token")
    )
    expect(storage).toEqual(
      expect.objectContaining({
        get: expect.any(Function),
        set: expect.any(Function),
        delete: expect.any(Function),
        getAndDelete: expect.any(Function),
        increment: expect.any(Function),
      })
    )
  })
})
