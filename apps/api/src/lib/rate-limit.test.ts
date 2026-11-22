import {
  PUBLIC_SSR_CLIENT_IP_HEADER,
  PUBLIC_SSR_SECRET_HEADER,
} from "@eleva/api-client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  isLocalPublicRateLimitExempt,
  rateLimitKey,
  trustedSsrClientIp,
} from "./rate-limit"

const FIXTURE = "fixture"

function ssrRequest(token: string | null, clientIp: string): Request {
  const headers: Record<string, string> = {
    "x-forwarded-for": "34.200.0.1",
    [PUBLIC_SSR_CLIENT_IP_HEADER]: clientIp,
  }
  if (token !== null) headers[PUBLIC_SSR_SECRET_HEADER] = token
  return new Request("https://api.eleva.care/public/experts/anaquick", {
    headers,
  })
}

describe("trustedSsrClientIp", () => {
  const env = { PUBLIC_SSR_SHARED_SECRET: FIXTURE }

  it("returns the forwarded visitor IP when the secret matches", () => {
    const request = ssrRequest(FIXTURE, "2001:db8::7")
    expect(trustedSsrClientIp(request, env)).toBe("2001:db8::7")
  })

  it("ignores the forwarded IP with a wrong or missing secret", () => {
    expect(
      trustedSsrClientIp(ssrRequest("fixturX", "203.0.113.9"), env)
    ).toBeNull()
    expect(trustedSsrClientIp(ssrRequest(null, "203.0.113.9"), env)).toBeNull()
  })

  it("is off when the API has no secret configured", () => {
    expect(trustedSsrClientIp(ssrRequest("", "203.0.113.9"), {})).toBeNull()
  })

  it("rejects values that are not an IP", () => {
    expect(
      trustedSsrClientIp(ssrRequest(FIXTURE, "user:attacker"), env)
    ).toBeNull()
    expect(
      trustedSsrClientIp(ssrRequest(FIXTURE, "1.2.3.4:5678"), env)
    ).toBeNull()
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("rateLimitKey IP debug", () => {
  it("logs a hashed key and header agreement, never the raw IP", () => {
    vi.stubEnv("RATE_LIMIT_IP_DEBUG", "true")
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const request = new Request("https://api.eleva.care/bookings/reserve", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "x-real-ip": "203.0.113.7",
      },
    })

    expect(rateLimitKey(request)).toBe("ip:203.0.113.7")
    const line = String(info.mock.calls[0]?.[0])
    expect(line).not.toContain("203.0.113.7")
    expect(JSON.parse(line)).toMatchObject({
      event: "rate_limit.ip_source",
      path: "/bookings/reserve",
      forwardedHops: 2,
      matchesRealIp: true,
      matchesVercelForwarded: null,
    })
  })

  it("stays silent unless the flag is set", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    rateLimitKey(new Request("https://api.eleva.care/x"))
    expect(info).not.toHaveBeenCalled()
  })
})

describe("isLocalPublicRateLimitExempt", () => {
  it("skips loopback and unknown SSR keys only when the local flag is set", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("API_URL", "http://127.0.0.1:3002")
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "1")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(true)
    expect(isLocalPublicRateLimitExempt("ip:::1")).toBe(true)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(true)
  })

  it("never skips unknown SSR when no API origin is configured", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("API_URL", "")
    vi.stubEnv("BETTER_AUTH_URL", "")
    vi.stubEnv("NEXT_PUBLIC_API_URL", "")
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "1")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(true)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })

  it("never skips unknown SSR when the API origin is not loopback", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("API_URL", "https://api.example.test")
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "1")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(true)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })

  it("never skips self-hosted production when the flag is unset", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })

  it("never skips on Vercel production even with the flag", () => {
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "1")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })

  it("never skips on Vercel preview even with the flag", () => {
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "1")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
  })

  it("never skips when NODE_ENV is production even with the flag", () => {
    vi.stubEnv("ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT", "1")
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })
})

describe("applyRateLimit outage behaviour", () => {
  type LimitAnswer = Record<string, unknown> | Error
  const HEALTHY = { success: true, remaining: 1, reset: Date.now() + 1000 }
  /** What the library answers when its store is slower than `timeout`. */
  const TIMED_OUT = {
    success: true,
    limit: 0,
    remaining: 0,
    reset: 0,
    pending: Promise.resolve(),
    reason: "timeout",
  }
  const constructed: Record<string, unknown>[] = []

  beforeEach(() => {
    // The module logs each time the store is silent; keep the run readable.
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  async function loadWithRedis(
    configured: boolean,
    answer: LimitAnswer = HEALTHY
  ) {
    vi.resetModules()
    constructed.length = 0
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }))
    vi.doMock("@upstash/ratelimit", () => {
      class Ratelimit {
        static slidingWindow() {
          return {}
        }
        constructor(options: Record<string, unknown>) {
          constructed.push(options)
        }
        async limit() {
          if (answer instanceof Error) throw answer
          return answer
        }
      }
      return { Ratelimit }
    })
    if (configured) {
      vi.stubEnv("KV_REST_API_URL", "https://redis.invalid")
      vi.stubEnv("KV_REST_API_TOKEN", "token")
    } else {
      vi.stubEnv("KV_REST_API_URL", "")
      vi.stubEnv("KV_REST_API_TOKEN", "")
    }
    return import("./rate-limit")
  }

  /** The one 503 every cause must produce, whatever made the store silent. */
  async function unavailable(response: Response | null) {
    return {
      status: response?.status,
      body: await response?.json(),
      headers: Object.fromEntries(response?.headers.entries() ?? []),
    }
  }

  it("fails closed with 503 for public and webhook tiers on Vercel without Redis", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(false)
    for (const config of [RATE_LIMITS.public, RATE_LIMITS.webhook]) {
      const response = await applyRateLimit("ip:203.0.113.7", config)
      expect(response?.status).toBe(503)
      expect(response?.headers.get("Retry-After")).toBe("30")
      expect(await response?.json()).toEqual({
        error: "rate_limit_unavailable",
      })
    }
  })

  it("fails closed on preview when the limiter throws", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(
      true,
      new Error("redis down")
    )
    const response = await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    expect(response?.status).toBe(503)
  })

  it("keeps authenticated tiers fail-open during an outage", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(false)
    expect(await applyRateLimit("user:1", RATE_LIMITS.authenticated)).toBeNull()
  })

  it("stays permissive off Vercel (local dev, CI)", async () => {
    vi.stubEnv("VERCEL_ENV", "")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(false)
    expect(
      await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    ).toBeNull()
  })

  it("allows requests when Redis is healthy", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(true)
    expect(
      await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    ).toBeNull()
  })

  it.each(["production", "preview"])(
    "refuses public and webhook requests when the store times out on %s",
    async (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv)
      const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(
        true,
        TIMED_OUT
      )
      for (const config of [
        RATE_LIMITS.public,
        RATE_LIMITS.publicSsr,
        RATE_LIMITS.webhook,
      ]) {
        const response = await applyRateLimit("ip:203.0.113.7", config)
        expect(response?.status).toBe(503)
        expect(response?.headers.get("Retry-After")).toBe("30")
        expect(await response?.json()).toEqual({
          error: "rate_limit_unavailable",
        })
      }
    }
  )

  it("still allows the fail-open tiers when the store throws, and says so once", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const warn = vi.mocked(console.warn)
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(
      true,
      new Error("redis down")
    )
    expect(await applyRateLimit("user:1", RATE_LIMITS.authenticated)).toBeNull()
    expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
      {
        event: "rate_limit.store_unavailable",
        cause: "error",
        class: "auth",
        refused: false,
        error: "Error",
      },
    ])
  })

  it("refuses, as for a store that is down, when the limiter cannot be built", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("KV_REST_API_URL", "not a url")
    vi.stubEnv("KV_REST_API_TOKEN", "token")
    vi.resetModules()
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        constructor() {
          throw new Error("UrlError")
        }
      },
    }))
    const { applyRateLimit, RATE_LIMITS } = await import("./rate-limit")
    const response = await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    expect(response?.status).toBe(503)
    expect(await response?.json()).toEqual({ error: "rate_limit_unavailable" })
    expect(await applyRateLimit("user:1", RATE_LIMITS.authenticated)).toBeNull()
  })

  it("still allows the fail-open tiers when the store times out", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(true, TIMED_OUT)
    for (const config of [
      RATE_LIMITS.authenticated,
      RATE_LIMITS.onboarding,
      RATE_LIMITS.icsFeed,
    ]) {
      expect(await applyRateLimit("user:1", config)).toBeNull()
    }
  })

  it("stays permissive off Vercel when the store times out", async () => {
    vi.stubEnv("VERCEL_ENV", "")
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(true, TIMED_OUT)
    expect(
      await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    ).toBeNull()
  })

  it("answers the same 503 whatever silenced the store, with the route's headers and no limit headers", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const cors = { "Access-Control-Allow-Origin": "https://eleva.care" }
    const answers = []
    for (const [configured, answer] of [
      [false, HEALTHY],
      [true, new Error("redis down")],
      [true, TIMED_OUT],
    ] as const) {
      const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(
        configured,
        answer
      )
      answers.push(
        await unavailable(
          await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public, cors)
        )
      )
    }
    expect(answers[0]).toMatchObject({
      status: 503,
      body: { error: "rate_limit_unavailable" },
    })
    expect(answers[0]?.headers).toMatchObject({
      "access-control-allow-origin": "https://eleva.care",
      "cache-control": "no-store",
      "retry-after": "30",
    })
    expect(
      Object.keys(answers[0]?.headers ?? {}).filter((name) =>
        name.startsWith("x-ratelimit")
      )
    ).toEqual([])
    expect(answers[1]).toEqual(answers[0])
    expect(answers[2]).toEqual(answers[0])
  })

  it("keeps the 429 for a caller the library already knows is over the limit", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const reset = Date.now() + 42_000
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(true, {
      success: false,
      limit: 10,
      remaining: 0,
      reset,
      pending: Promise.resolve(),
      reason: "cacheBlock",
    })
    const response = await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    expect(response?.status).toBe(429)
    expect(await response?.json()).toEqual({
      error: "rate_limit_exceeded",
      retryAfter: reset,
    })
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0)
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("10")
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0")
  })

  it("logs the cause and the class once, and nothing about who asked", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const secretLooking = new Error("connect ECONNREFUSED redis://user:pw@host")
    for (const answer of [TIMED_OUT, secretLooking]) {
      const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(true, answer)
      await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    }
    expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
      {
        event: "rate_limit.store_unavailable",
        cause: "timeout",
        class: "pub",
        refused: true,
      },
      {
        event: "rate_limit.store_unavailable",
        cause: "error",
        class: "pub",
        refused: true,
        error: "Error",
      },
    ])
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/203\.0\.113\.7|pw@/)
  })

  it("does not log every request when no store is configured off Vercel", async () => {
    vi.stubEnv("VERCEL_ENV", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const { applyRateLimit, RATE_LIMITS } = await loadWithRedis(false)
    await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    await applyRateLimit("user:1", RATE_LIMITS.authenticated)
    expect(warn).not.toHaveBeenCalled()
  })

  it("builds every limiter with the explicit timeout", async () => {
    const { applyRateLimit, RATE_LIMITS, RATE_LIMIT_STORE_TIMEOUT_MS } =
      await loadWithRedis(true)
    await applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public)
    await applyRateLimit("user:1", RATE_LIMITS.authenticated)
    expect(RATE_LIMIT_STORE_TIMEOUT_MS).toBeGreaterThanOrEqual(500)
    expect(RATE_LIMIT_STORE_TIMEOUT_MS).toBeLessThanOrEqual(2_000)
    expect(constructed).toHaveLength(2)
    for (const options of constructed) {
      expect(options.timeout).toBe(RATE_LIMIT_STORE_TIMEOUT_MS)
    }
  })

  it("keeps the public limit at 10 a minute", async () => {
    const { RATE_LIMITS } = await loadWithRedis(false)
    expect(RATE_LIMITS.public).toMatchObject({
      maxRequests: 10,
      windowMs: 60_000,
    })
  })
})

describe("applyRateLimit with the real library and a store that never answers", () => {
  /** A Redis client whose every call hangs, as a dead connection does. */
  function hangingRedis() {
    const never = () => new Promise(() => {})
    return new Proxy(
      {},
      { get: (_target, prop) => (prop === "then" ? undefined : never) }
    )
  }

  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock("@upstash/redis")
  })

  it("waits the timeout and no longer, then refuses public and allows signed-in", async () => {
    vi.resetModules()
    vi.doUnmock("@upstash/ratelimit")
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        constructor() {
          return hangingRedis()
        }
      },
    }))
    vi.stubEnv("KV_REST_API_URL", "https://redis.invalid")
    vi.stubEnv("KV_REST_API_TOKEN", "fixture")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    // Imported before the clock is faked: the import itself needs real timers.
    const { applyRateLimit, RATE_LIMITS, RATE_LIMIT_STORE_TIMEOUT_MS } =
      await import("./rate-limit")
    vi.useFakeTimers()

    let publicAnswer: Response | null | "pending" = "pending"
    let signedInAnswer: Response | null | "pending" = "pending"
    void applyRateLimit("ip:203.0.113.7", RATE_LIMITS.public).then((answer) => {
      publicAnswer = answer
    })
    void applyRateLimit("user:1", RATE_LIMITS.authenticated).then((answer) => {
      signedInAnswer = answer
    })

    await vi.advanceTimersByTimeAsync(RATE_LIMIT_STORE_TIMEOUT_MS - 1)
    expect(publicAnswer).toBe("pending")
    expect(signedInAnswer).toBe("pending")

    await vi.advanceTimersByTimeAsync(1)
    expect((publicAnswer as unknown as Response).status).toBe(503)
    expect(signedInAnswer).toBeNull()
  })
})
