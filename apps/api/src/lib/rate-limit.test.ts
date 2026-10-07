import { afterEach, describe, expect, it, vi } from "vitest"
import { isLocalPublicRateLimitExempt, rateLimitKey } from "./rate-limit"

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
