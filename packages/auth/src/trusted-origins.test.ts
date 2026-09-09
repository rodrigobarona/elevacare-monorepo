import { afterEach, describe, expect, it } from "vitest"
import { isTrustedOrigin, trustedOrigins } from "./trusted-origins"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("trustedOrigins", () => {
  it("includes localhost and 127.0.0.1 app ports outside production", () => {
    delete process.env.VERCEL_ENV
    const origins = trustedOrigins({ NODE_ENV: "test" })
    expect(origins).toContain("http://localhost:3002")
    expect(origins).toContain("http://localhost:3006")
    expect(origins).toContain("http://127.0.0.1:3002")
    expect(origins).toContain("http://127.0.0.1:3006")
    expect(origins).toContain("https://api.eleva.care")
  })

  it("excludes loopback origins on preview and production, not local vercel pull", () => {
    expect(trustedOrigins({ VERCEL_ENV: "production" })).not.toContain(
      "http://localhost:3002"
    )
    expect(trustedOrigins({ VERCEL_ENV: "preview" })).not.toContain(
      "http://127.0.0.1:3006"
    )
    expect(trustedOrigins({ VERCEL_ENV: "development" })).toContain(
      "http://localhost:3006"
    )
    expect(trustedOrigins({ VERCEL_ENV: "production" })).toContain(
      "https://api.eleva.care"
    )
  })

  it("rejects an unknown origin", () => {
    expect(isTrustedOrigin("https://evil.example")).toBe(false)
    expect(isTrustedOrigin(null)).toBe(false)
  })

  it("drops loopback extras from ELEVA_TRUSTED_ORIGINS when deployed", () => {
    const origins = trustedOrigins({
      VERCEL_ENV: "preview",
      ELEVA_TRUSTED_ORIGINS:
        "http://localhost:3006,https://evil.example,https://app.eleva.care",
    })
    expect(origins).not.toContain("http://localhost:3006")
    expect(origins).not.toContain("https://evil.example")
    expect(origins).toContain("https://app.eleva.care")
  })
})
