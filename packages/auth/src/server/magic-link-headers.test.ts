import { describe, expect, it } from "vitest"
import {
  magicLinkServerHeaders,
  magicLinkServerOrigin,
} from "./magic-link-headers"

describe("magicLinkServerHeaders", () => {
  it("uses the Better Auth issuer origin so CSRF/origin checks can pass", () => {
    expect(
      magicLinkServerOrigin({ BETTER_AUTH_URL: "http://localhost:3002/auth" })
    ).toBe("http://localhost:3002")
    expect(
      magicLinkServerOrigin({
        BETTER_AUTH_URL: "https://api.eleva.care/auth",
      })
    ).toBe("https://api.eleva.care")
    expect(magicLinkServerOrigin({})).toBe("http://localhost:3002")
  })

  it("always includes origin and JSON content-type", () => {
    const headers = magicLinkServerHeaders({
      BETTER_AUTH_URL: "http://localhost:3002/auth",
    })
    expect(headers.get("origin")).toBe("http://localhost:3002")
    expect(headers.get("content-type")).toBe("application/json")
  })
})
