import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@eleva/config/env", () => ({
  env: () => ({ NODE_ENV: "production", APP_URL: "https://eleva.care" }),
}))

import { corsHeaders, matchAllowedOrigin } from "./cors"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("matchAllowedOrigin", () => {
  it("allows first-party hosts over HTTPS, including dev.eleva.care", () => {
    for (const origin of [
      "https://dev.eleva.care",
      "https://expert.eleva.care",
      "https://admin.dev.eleva.care",
    ]) {
      expect(matchAllowedOrigin(origin, "production")).toBe(origin)
    }
  })

  it("never trusts the apex while it serves the previous app", () => {
    // APP_URL is https://eleva.care in this mock: the explicit match must
    // not bypass the apex rule either.
    expect(matchAllowedOrigin("https://eleva.care", "production")).toBeNull()
    expect(
      matchAllowedOrigin("https://www.eleva.care", "production")
    ).toBeNull()
  })

  it("trusts the apex once it serves v3", () => {
    vi.stubEnv("ELEVA_APEX_IS_V3", "true")
    expect(matchAllowedOrigin("https://eleva.care", "production")).toBe(
      "https://eleva.care"
    )
  })

  it("refuses plain HTTP, even for a first-party host", () => {
    expect(matchAllowedOrigin("http://dev.eleva.care", "production")).toBeNull()
    expect(matchAllowedOrigin("http://admin.eleva.care", "preview")).toBeNull()
  })

  it("never trusts preview hosts in production", () => {
    expect(
      matchAllowedOrigin("https://evil.preview.eleva.care", "production")
    ).toBeNull()
  })

  it("lets a preview deployment trust preview hosts", () => {
    expect(
      matchAllowedOrigin("https://pr-12.preview.eleva.care", "preview")
    ).toBe("https://pr-12.preview.eleva.care")
  })

  it("refuses look-alike and unknown hosts", () => {
    for (const origin of [
      "https://eleva.care.evil.com",
      "https://evileleva.care",
      "https://staging.dev.eleva.care",
      "https://localhost:3000",
      "null",
    ]) {
      expect(matchAllowedOrigin(origin, "production")).toBeNull()
    }
  })

  it("adds credentials only for an allowed origin", () => {
    const allowed = corsHeaders(
      new Request("https://api.eleva.care/x", {
        headers: { origin: "https://dev.eleva.care" },
      })
    )
    expect(allowed["Access-Control-Allow-Credentials"]).toBe("true")
    const refused = corsHeaders(
      new Request("https://api.eleva.care/x", {
        headers: { origin: "http://eleva.care" },
      })
    )
    expect(refused["Access-Control-Allow-Origin"]).toBeUndefined()
    expect(refused["Access-Control-Allow-Credentials"]).toBeUndefined()
  })
})
