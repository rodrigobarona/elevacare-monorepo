import { describe, expect, it } from "vitest"
import {
  authRateLimitEnabled,
  e2eAuthUrlKey,
  shouldPersistE2eAuthUrl,
} from "./e2e-auth-url"

describe("e2eAuthUrlKey", () => {
  it("hashes the email so Redis keys do not store raw addresses", () => {
    const key = e2eAuthUrlKey("verify-email", "  Member@Example.COM ")
    expect(key.startsWith("e2e:auth-url:verify-email:")).toBe(true)
    expect(key).not.toContain("member@example.com")
    expect(key).toBe(e2eAuthUrlKey("verify-email", "member@example.com"))
  })
})

describe("shouldPersistE2eAuthUrl", () => {
  it("requires an explicit capture flag and never runs in Vercel production", () => {
    expect(shouldPersistE2eAuthUrl({ E2E_AUTH_CAPTURE: "1" })).toBe(true)
    expect(shouldPersistE2eAuthUrl({})).toBe(false)
    expect(
      shouldPersistE2eAuthUrl({
        E2E_AUTH_CAPTURE: "1",
        VERCEL_ENV: "production",
      })
    ).toBe(false)
    expect(
      shouldPersistE2eAuthUrl({
        E2E_AUTH_CAPTURE: "1",
        NODE_ENV: "production",
      })
    ).toBe(false)
  })
})

describe("authRateLimitEnabled", () => {
  it("is on for Vercel production and preview, and self-hosted production", () => {
    expect(authRateLimitEnabled(true, { VERCEL_ENV: "production" })).toBe(true)
    expect(authRateLimitEnabled(true, { VERCEL_ENV: "preview" })).toBe(true)
    expect(authRateLimitEnabled(true, { NODE_ENV: "production" })).toBe(true)
    expect(
      authRateLimitEnabled(true, {
        VERCEL_ENV: "production",
        E2E_AUTH_CAPTURE: "1",
      })
    ).toBe(true)
    expect(
      authRateLimitEnabled(true, {
        NODE_ENV: "production",
        E2E_AUTH_CAPTURE: "1",
      })
    ).toBe(true)
  })

  it("stays off locally and when storage is missing", () => {
    expect(authRateLimitEnabled(false, { VERCEL_ENV: "production" })).toBe(
      false
    )
    expect(authRateLimitEnabled(true, { NODE_ENV: "development" })).toBe(false)
    expect(
      authRateLimitEnabled(true, {
        VERCEL_ENV: "development",
        E2E_AUTH_CAPTURE: "1",
      })
    ).toBe(false)
  })
})
