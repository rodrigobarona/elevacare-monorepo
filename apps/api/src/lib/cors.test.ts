import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/config/env", () => ({
  env: () => ({ NODE_ENV: "production", APP_URL: "https://eleva.care" }),
}))

import { corsHeaders, matchAllowedOrigin } from "./cors"

describe("matchAllowedOrigin", () => {
  it("allows first-party hosts over HTTPS, including dev.eleva.care", () => {
    for (const origin of [
      "https://eleva.care",
      "https://dev.eleva.care",
      "https://expert.eleva.care",
      "https://admin.dev.eleva.care",
    ]) {
      expect(matchAllowedOrigin(origin, "production")).toBe(origin)
    }
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
        headers: { origin: "https://eleva.care" },
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
