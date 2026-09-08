import { describe, expect, it } from "vitest"
import { UnauthorizedError } from "../types"
import { assertCookieCsrf } from "./csrf"

describe("assertCookieCsrf", () => {
  it("allows GET without origin", () => {
    expect(() =>
      assertCookieCsrf(new Request("http://localhost/x", { method: "GET" }))
    ).not.toThrow()
  })

  it("allows same-site POST from a trusted origin", () => {
    expect(() =>
      assertCookieCsrf(
        new Request("http://localhost/x", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-site",
          },
        })
      )
    ).not.toThrow()
  })

  it("rejects cross-site cookie POST", () => {
    expect(() =>
      assertCookieCsrf(
        new Request("http://localhost/x", {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
        })
      )
    ).toThrow(UnauthorizedError)
    try {
      assertCookieCsrf(
        new Request("http://localhost/x", {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
        })
      )
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
      expect((err as UnauthorizedError).code).toBe("csrf-origin-mismatch")
      expect((err as UnauthorizedError).message).toBe("CSRF_ORIGIN_MISMATCH")
    }
  })

  it("rejects a cookie POST with no Origin and no Sec-Fetch-Site", () => {
    expect(() =>
      assertCookieCsrf(new Request("http://localhost/x", { method: "POST" }))
    ).toThrow(UnauthorizedError)
  })

  it("allows a cookie POST with same-origin metadata and no Origin", () => {
    expect(() =>
      assertCookieCsrf(
        new Request("http://localhost/x", {
          method: "POST",
          headers: { "sec-fetch-site": "same-origin" },
        })
      )
    ).not.toThrow()
  })

  it("rejects an untrusted Origin on POST", () => {
    expect(() =>
      assertCookieCsrf(
        new Request("http://localhost/x", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        })
      )
    ).toThrow(UnauthorizedError)
  })
})
