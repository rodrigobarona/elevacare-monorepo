import { afterEach, describe, expect, it } from "vitest"
import { isLocalPublicRateLimitExempt } from "./rate-limit"

const originalVercel = process.env.VERCEL
const originalVercelEnv = process.env.VERCEL_ENV
const originalExempt = process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = originalVercel
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalVercelEnv
  if (originalExempt === undefined) {
    delete process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT
  } else {
    process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT = originalExempt
  }
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
})

describe("isLocalPublicRateLimitExempt", () => {
  it("skips loopback and unknown SSR keys only when the local flag is set", () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = "test"
    process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT = "1"
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(true)
    expect(isLocalPublicRateLimitExempt("ip:::1")).toBe(true)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(true)
  })

  it("never skips self-hosted production when the flag is unset", () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    delete process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })

  it("never skips on Vercel production even with the flag", () => {
    process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT = "1"
    process.env.VERCEL = "1"
    process.env.VERCEL_ENV = "production"
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })

  it("never skips on Vercel preview even with the flag", () => {
    process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT = "1"
    process.env.VERCEL = "1"
    process.env.VERCEL_ENV = "preview"
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
  })

  it("never skips when NODE_ENV is production even with the flag", () => {
    process.env.ELEVA_LOCAL_PUBLIC_RATE_LIMIT_EXEMPT = "1"
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = "production"
    expect(isLocalPublicRateLimitExempt("ip:127.0.0.1")).toBe(false)
    expect(isLocalPublicRateLimitExempt("ip:unknown")).toBe(false)
  })
})
