import { afterEach, describe, expect, it, vi } from "vitest"
import { passkeyOrigins } from "./passkey-origin"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("passkeyOrigins", () => {
  it("parses a comma-separated list and strips trailing slashes", () => {
    vi.stubEnv(
      "PASSKEY_ORIGIN",
      "https://eleva.care/, https://account.eleva.care"
    )
    expect(passkeyOrigins()).toEqual([
      "https://eleva.care",
      "https://account.eleva.care",
    ])
  })

  it("returns null locally when unset", () => {
    vi.stubEnv("PASSKEY_ORIGIN", "")
    vi.stubEnv("VERCEL_ENV", "")
    expect(passkeyOrigins()).toBeNull()
  })

  it.each(["production", "preview"])(
    "throws on Vercel %s when unset",
    (vercelEnv) => {
      vi.stubEnv("PASSKEY_ORIGIN", "")
      vi.stubEnv("VERCEL_ENV", vercelEnv)
      expect(() => passkeyOrigins()).toThrow(/PASSKEY_ORIGIN is required/)
    }
  )
})
