import { describe, expect, it } from "vitest"
import { sanitizeReturnTo } from "./return-to"

describe("sanitizeReturnTo", () => {
  describe("null/empty input", () => {
    it("returns undefined for null", () => {
      expect(sanitizeReturnTo(null)).toBeUndefined()
    })

    it("returns undefined for undefined", () => {
      expect(sanitizeReturnTo(undefined)).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(sanitizeReturnTo("")).toBeUndefined()
    })
  })

  describe("relative paths", () => {
    it("accepts simple relative paths", () => {
      expect(sanitizeReturnTo("/")).toBe("/")
      expect(sanitizeReturnTo("/dashboard")).toBe("/dashboard")
      expect(sanitizeReturnTo("/clinica-mota/expert")).toBe(
        "/clinica-mota/expert"
      )
    })

    it("accepts URL-encoded relative paths", () => {
      expect(sanitizeReturnTo("%2Fclinica-mota")).toBe("/clinica-mota")
      expect(sanitizeReturnTo("%2Fdashboard%3Ffoo%3Dbar")).toBe(
        "/dashboard?foo=bar"
      )
    })

    it("accepts paths with query and hash", () => {
      expect(sanitizeReturnTo("/foo?x=1&y=2")).toBe("/foo?x=1&y=2")
      expect(sanitizeReturnTo("/foo#section")).toBe("/foo#section")
    })

    it("rejects protocol-relative URLs (//evil.com)", () => {
      expect(sanitizeReturnTo("//evil.com/path")).toBeUndefined()
      expect(sanitizeReturnTo("%2F%2Fevil.com")).toBeUndefined()
    })

    it("rejects relative paths containing ://", () => {
      expect(sanitizeReturnTo("/path?next=http://evil.com")).toBeUndefined()
    })
  })

  describe("absolute URLs", () => {
    it("accepts eleva.care and extracts the relative portion", () => {
      expect(sanitizeReturnTo("https://eleva.care/dashboard")).toBe(
        "/dashboard"
      )
      expect(sanitizeReturnTo("https://eleva.care/foo?x=1")).toBe("/foo?x=1")
    })

    it("accepts www.eleva.care", () => {
      expect(sanitizeReturnTo("https://www.eleva.care/about")).toBe("/about")
    })

    it("accepts localhost for dev", () => {
      expect(sanitizeReturnTo("http://localhost:3000/dashboard")).toBe(
        "/dashboard"
      )
    })

    it("normalizes empty path to /", () => {
      expect(sanitizeReturnTo("https://eleva.care")).toBe("/")
      expect(sanitizeReturnTo("https://eleva.care/")).toBe("/")
    })

    it("rejects subdomains (no wildcard match)", () => {
      expect(sanitizeReturnTo("https://evil.eleva.care/path")).toBeUndefined()
      expect(
        sanitizeReturnTo("https://app.eleva.care/dashboard")
      ).toBeUndefined()
    })

    it("rejects look-alike hosts ending with eleva.care", () => {
      expect(sanitizeReturnTo("https://evil-eleva.care/path")).toBeUndefined()
    })

    it("rejects foreign hosts", () => {
      expect(sanitizeReturnTo("https://evil.com/foo")).toBeUndefined()
      expect(sanitizeReturnTo("https://google.com")).toBeUndefined()
    })

    it("rejects javascript: and data: schemes (parsed as opaque URL)", () => {
      expect(sanitizeReturnTo("javascript:alert(1)")).toBeUndefined()
      expect(sanitizeReturnTo("data:text/html,<script>")).toBeUndefined()
    })
  })

  describe("malformed input", () => {
    it("returns undefined for invalid URLs", () => {
      expect(sanitizeReturnTo("not a url")).toBeUndefined()
      expect(sanitizeReturnTo("http://")).toBeUndefined()
    })

    it("returns undefined for malformed percent-encoding", () => {
      expect(sanitizeReturnTo("%ZZ")).toBeUndefined()
    })
  })
})
