import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  env,
  resetEnvCache,
  requireAuthEnv,
  requireCronSecret,
  requireDbEnv,
  resolveMicrosoftOAuth,
} from "./env"

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
      "BETTER_AUTH_SECRET",
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
    delete process.env.BETTER_AUTH_SECRET
    delete process.env.BETTER_AUTH_URL
    expect(() => requireAuthEnv()).toThrow(
      /BETTER_AUTH_SECRET.*BETTER_AUTH_URL/
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

describe("requireCronSecret", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL }
    resetEnvCache()
  })

  afterEach(() => {
    process.env = ORIGINAL
    resetEnvCache()
  })

  it("throws when CRON_SECRET is unset (fail closed)", () => {
    delete process.env.CRON_SECRET
    expect(() => requireCronSecret()).toThrow(/CRON_SECRET/)
  })

  it("returns the secret when present", () => {
    process.env.CRON_SECRET = "shhhh"
    expect(requireCronSecret().CRON_SECRET).toBe("shhhh")
  })
})

describe("resolveMicrosoftOAuth", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL }
    resetEnvCache()
  })

  afterEach(() => {
    process.env = ORIGINAL
    resetEnvCache()
  })

  it("prefers MICROSOFT_OAUTH_* over MS_OAUTH_*", () => {
    process.env.MICROSOFT_OAUTH_CLIENT_ID = "canonical-id"
    process.env.MICROSOFT_OAUTH_CLIENT_SECRET = "canonical-secret"
    process.env.MS_OAUTH_CLIENT_ID = "legacy-id"
    process.env.MS_OAUTH_CLIENT_SECRET = "legacy-secret"
    expect(resolveMicrosoftOAuth()).toEqual({
      clientId: "canonical-id",
      clientSecret: "canonical-secret",
    })
  })

  it("falls back to MS_OAUTH_* when the canonical pair is unset", () => {
    delete process.env.MICROSOFT_OAUTH_CLIENT_ID
    delete process.env.MICROSOFT_OAUTH_CLIENT_SECRET
    process.env.MS_OAUTH_CLIENT_ID = "legacy-id"
    process.env.MS_OAUTH_CLIENT_SECRET = "legacy-secret"
    expect(resolveMicrosoftOAuth()).toEqual({
      clientId: "legacy-id",
      clientSecret: "legacy-secret",
    })
  })

  it("uses the complete legacy pair when the canonical pair is partial", () => {
    process.env.MICROSOFT_OAUTH_CLIENT_ID = "canonical-id"
    delete process.env.MICROSOFT_OAUTH_CLIENT_SECRET
    process.env.MS_OAUTH_CLIENT_ID = "legacy-id"
    process.env.MS_OAUTH_CLIENT_SECRET = "legacy-secret"
    expect(resolveMicrosoftOAuth()).toEqual({
      clientId: "legacy-id",
      clientSecret: "legacy-secret",
    })
  })
})
