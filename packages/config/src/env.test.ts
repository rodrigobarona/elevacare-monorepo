import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  env,
  resetEnvCache,
  requireAuthEnv,
  requireCronSecret,
  requireDbEnv,
  requireToconlineEnv,
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

  it("requireAuthEnv rejects a short BETTER_AUTH_SECRET", () => {
    process.env.BETTER_AUTH_SECRET = "too-short"
    process.env.BETTER_AUTH_URL = "https://api.eleva.care"
    expect(() => requireAuthEnv()).toThrow(/32 characters/)
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

describe("requireToconlineEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL }
    resetEnvCache()
  })

  afterEach(() => {
    process.env = ORIGINAL
    resetEnvCache()
  })

  it("prefers canonical BASE_URL / OAUTH_REDIRECT names", () => {
    process.env.TOCONLINE_CLIENT_ID = "id"
    process.env.TOCONLINE_CLIENT_SECRET = "secret"
    process.env.TOCONLINE_API_BASE_URL = "https://api33.toconline.pt"
    process.env.TOCONLINE_OAUTH_BASE_URL = "https://app33.toconline.pt/oauth"
    process.env.TOCONLINE_OAUTH_REDIRECT = "https://eleva.care/callback"
    process.env.TOCONLINE_API_URL = "https://legacy-api.toconline.pt"
    process.env.TOCONLINE_OAUTH_URL = "https://legacy-oauth.toconline.pt/oauth"
    process.env.TOCONLINE_URI_REDIRECT = "https://legacy.example/callback"
    process.env.TOCONLINE_SERIES_PREFIX = "TEST"
    expect(requireToconlineEnv()).toEqual({
      TOCONLINE_CLIENT_ID: "id",
      TOCONLINE_CLIENT_SECRET: "secret",
      TOCONLINE_API_URL: "https://api33.toconline.pt",
      TOCONLINE_OAUTH_URL: "https://app33.toconline.pt/oauth",
      TOCONLINE_URI_REDIRECT: "https://eleva.care/callback",
      TOCONLINE_SERIES_PREFIX: "TEST",
    })
  })

  it("falls back to legacy aliases when canonical names are unset", () => {
    process.env.TOCONLINE_CLIENT_ID = "id"
    process.env.TOCONLINE_CLIENT_SECRET = "secret"
    process.env.TOCONLINE_API_URL = "https://api33.toconline.pt"
    process.env.TOCONLINE_OAUTH_URL = "https://app33.toconline.pt/oauth"
    process.env.TOCONLINE_URI_REDIRECT = "https://legacy.example/callback"
    process.env.TOCONLINE_SERIES_PREFIX = "TEST"
    expect(requireToconlineEnv().TOCONLINE_API_URL).toBe(
      "https://api33.toconline.pt"
    )
    expect(requireToconlineEnv().TOCONLINE_OAUTH_URL).toBe(
      "https://app33.toconline.pt/oauth"
    )
    expect(requireToconlineEnv().TOCONLINE_URI_REDIRECT).toBe(
      "https://legacy.example/callback"
    )
  })

  it("rejects a non-TOConline OAuth host so the client secret cannot leak", () => {
    process.env.TOCONLINE_CLIENT_ID = "id"
    process.env.TOCONLINE_CLIENT_SECRET = "secret"
    process.env.TOCONLINE_API_BASE_URL = "https://api33.toconline.pt"
    process.env.TOCONLINE_OAUTH_BASE_URL = "https://evil.example/oauth"
    process.env.TOCONLINE_OAUTH_REDIRECT = "https://eleva.care/callback"
    process.env.TOCONLINE_SERIES_PREFIX = "TEST"
    expect(() => requireToconlineEnv()).toThrow(/TOCONLINE_OAUTH_BASE_URL/)
  })

  it("refuses a live ELEVA series prefix outside production", () => {
    process.env.TOCONLINE_CLIENT_ID = "id"
    process.env.TOCONLINE_CLIENT_SECRET = "secret"
    process.env.TOCONLINE_API_BASE_URL = "https://api33.toconline.pt"
    process.env.TOCONLINE_OAUTH_BASE_URL = "https://app33.toconline.pt/oauth"
    process.env.TOCONLINE_OAUTH_REDIRECT = "https://eleva.care/callback"
    process.env.TOCONLINE_SERIES_PREFIX = "ELEVA"
    expect(() => requireToconlineEnv()).toThrow(/TOCONLINE_SERIES_PREFIX/)
  })

  it("rejects plaintext HTTP TOConline API hosts", () => {
    process.env.TOCONLINE_CLIENT_ID = "id"
    process.env.TOCONLINE_CLIENT_SECRET = "secret"
    process.env.TOCONLINE_API_BASE_URL = "http://api33.toconline.pt"
    process.env.TOCONLINE_OAUTH_BASE_URL = "https://app33.toconline.pt/oauth"
    process.env.TOCONLINE_OAUTH_REDIRECT = "https://eleva.care/callback"
    process.env.TOCONLINE_SERIES_PREFIX = "TEST"
    expect(() => requireToconlineEnv()).toThrow(/HTTPS/)
  })
})
