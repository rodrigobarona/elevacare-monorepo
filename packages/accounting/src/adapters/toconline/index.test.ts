import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetEnvCache } from "@eleva/config/env"
import { toconlineAdapter } from "./index"

describe("toconlineAdapter.buildAuthUrl", () => {
  beforeEach(() => {
    resetEnvCache()
    vi.stubEnv("TOCONLINE_CLIENT_ID", "test-client-id")
    vi.stubEnv("TOCONLINE_CLIENT_SECRET", "test-secret")
    vi.stubEnv("TOCONLINE_OAUTH_URL", "https://app33.toconline.pt/oauth")
    vi.stubEnv("TOCONLINE_API_URL", "https://api33.toconline.pt")
    vi.stubEnv(
      "TOCONLINE_URI_REDIRECT",
      "http://localhost:3000/api/auth/toconline/callback"
    )
    vi.stubEnv("TOCONLINE_SERIES_PREFIX", "ELEVA")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEnvCache()
  })

  it("emits a PKCE-S256 authorization URL with required params", async () => {
    const result = await toconlineAdapter.buildAuthUrl?.({
      state: "abc",
      expertProfileId: "exp_1",
    })
    expect(result).not.toBeNull()
    expect(result?.codeVerifier).toBeTruthy()
    expect(result!.codeVerifier!.length).toBeGreaterThan(20)

    const url = new URL(result!.url)
    expect(url.host).toBe("app33.toconline.pt")
    expect(url.pathname).toBe("/oauth/auth")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe("test-client-id")
    expect(url.searchParams.get("scope")).toBe("commercial")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("state")).toBe("abc")
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/toconline/callback"
    )
    // verifier is the raw value; the URL carries the SHA-256 of it
    expect(url.searchParams.get("code_challenge")).toBeTruthy()
    expect(url.searchParams.get("code_challenge")).not.toBe(
      result!.codeVerifier
    )
  })

  it("manifest advertises PT-only OAuth install", () => {
    expect(toconlineAdapter.manifest.slug).toBe("toconline")
    expect(toconlineAdapter.manifest.installType).toBe("oauth")
    expect(toconlineAdapter.manifest.countries).toContain("PT")
  })
})
