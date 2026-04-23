import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { env, resetEnvCache, requireAuthEnv, requireDbEnv } from "./env"

const ORIGINAL = process.env

describe("env()", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL }
    resetEnvCache()
  })

  afterEach(() => {
    process.env = ORIGINAL
    resetEnvCache()
  })

  it("accepts an empty environment (all optional)", () => {
    for (const k of [
      "APP_URL",
      "API_URL",
      "DOCS_URL",
      "WORKOS_API_KEY",
      "DATABASE_URL",
      "SENTRY_DSN",
    ]) {
      delete process.env[k]
    }
    expect(() => env()).not.toThrow()
    expect(env().NODE_ENV).toBe("test")
  })

  it("parses valid URLs", () => {
    process.env.APP_URL = "https://eleva.care"
    process.env.API_URL = "https://api.eleva.care"
    expect(env().APP_URL).toBe("https://eleva.care")
    expect(env().API_URL).toBe("https://api.eleva.care")
  })

  it("rejects a non-postgres DATABASE_URL", () => {
    process.env.DATABASE_URL = "https://not-postgres"
    expect(() => env()).toThrow(/DATABASE_URL/)
  })

  it("memoises parsed values", () => {
    const first = env()
    const second = env()
    expect(first).toBe(second)
  })
})

describe("requireAuthEnv / requireDbEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL }
    resetEnvCache()
  })

  afterEach(() => {
    process.env = ORIGINAL
    resetEnvCache()
  })

  it("requireAuthEnv lists every missing key at once", () => {
    delete process.env.WORKOS_API_KEY
    delete process.env.WORKOS_CLIENT_ID
    delete process.env.WORKOS_COOKIE_PASSWORD
    expect(() => requireAuthEnv()).toThrow(
      /WORKOS_API_KEY.*WORKOS_CLIENT_ID.*WORKOS_COOKIE_PASSWORD/
    )
  })

  it("requireDbEnv throws without DATABASE_URL", () => {
    delete process.env.DATABASE_URL
    expect(() => requireDbEnv()).toThrow(/DATABASE_URL/)
  })

  it("requireDbEnv returns the URL when present", () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db"
    expect(requireDbEnv().DATABASE_URL).toBe("postgres://user:pass@host/db")
  })
})
