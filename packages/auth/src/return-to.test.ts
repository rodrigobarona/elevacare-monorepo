import { describe, expect, it } from "vitest"
import {
  consoleReturnPath,
  consoleReturnTo,
  isTrustedReturnTo,
  rewriteMagicLinkVerifyUrl,
  sanitizeReturnTo,
  toGatewayCallbackURL,
} from "./return-to"

describe("sanitizeReturnTo", () => {
  it("rejects paths a browser would turn into another site (SEC-2-06)", () => {
    for (const raw of [
      "/\\evil.com",
      "/\\/evil.com",
      "%2F%5Cevil.com",
      "/\t/evil.com",
      "%2F%09%2Fevil.com",
      "/\n/evil.com",
      "/%0D%0A/evil.com",
    ]) {
      expect(sanitizeReturnTo(raw), JSON.stringify(raw)).toBeUndefined()
    }
  })

  it("keeps ordinary paths with query and hash", () => {
    expect(sanitizeReturnTo("/expert/acme/calendar?week=2#today")).toBe(
      "/expert/acme/calendar?week=2#today"
    )
  })

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

    it("accepts the staging gateway, so switching workspaces lands there", () => {
      expect(
        sanitizeReturnTo("https://dev.eleva.care/expert/patricia-mota-pt")
      ).toBe("/expert/patricia-mota-pt")
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

  describe("toGatewayCallbackURL", () => {
    const gateway = "http://localhost:3000"

    it("sends product paths through gateway /dashboard?returnTo=", () => {
      expect(
        toGatewayCallbackURL(
          "/expert/rbarona/sessions/92cbc729-aa25-478b-99a2-c94a37d145ce/join",
          gateway
        )
      ).toBe(
        "http://localhost:3000/dashboard?returnTo=%2Fexpert%2Frbarona%2Fsessions%2F92cbc729-aa25-478b-99a2-c94a37d145ce%2Fjoin"
      )
    })

    it("extracts the path from a local expert-zone URL", () => {
      expect(
        toGatewayCallbackURL(
          "http://localhost:3003/expert/rbarona/sessions/abc/join",
          gateway
        )
      ).toBe(
        "http://localhost:3000/dashboard?returnTo=%2Fexpert%2Frbarona%2Fsessions%2Fabc%2Fjoin"
      )
    })

    it("keeps account-native destinations on the gateway origin", () => {
      expect(toGatewayCallbackURL("/dashboard", gateway)).toBe(
        "http://localhost:3000/dashboard"
      )
      expect(toGatewayCallbackURL("/verify-email", gateway)).toBe(
        "http://localhost:3000/verify-email"
      )
    })

    it("falls back to gateway /dashboard when returnTo is invalid", () => {
      expect(toGatewayCallbackURL("https://evil.com/foo", gateway)).toBe(
        "http://localhost:3000/dashboard"
      )
      expect(toGatewayCallbackURL(null, gateway)).toBe(
        "http://localhost:3000/dashboard"
      )
    })

    it("keeps an already-built gateway callback with nested query params", () => {
      const built = toGatewayCallbackURL("/join/abc?foo=1&bar=2", gateway)
      expect(built).toBe(
        "http://localhost:3000/dashboard?returnTo=%2Fjoin%2Fabc%3Ffoo%3D1%26bar%3D2"
      )
      expect(toGatewayCallbackURL(built, gateway)).toBe(built)
    })
  })

  describe("isTrustedReturnTo", () => {
    const gateway = "http://localhost:3000"

    it("accepts a same-origin gateway callback", () => {
      expect(
        isTrustedReturnTo(
          "http://localhost:3000/dashboard?returnTo=%2Fjoin%2Fabc%3Ffoo%3D1%26bar%3D2",
          gateway
        )
      ).toBe(true)
    })

    it("rejects invalid values so callers can use stored returnTo", () => {
      expect(isTrustedReturnTo("https://evil.com/foo", gateway)).toBe(false)
      expect(isTrustedReturnTo(null, gateway)).toBe(false)
    })
  })

  describe("rewriteMagicLinkVerifyUrl", () => {
    const gateway = "http://localhost:3000"
    const verify =
      "http://localhost:3002/auth/magic-link/verify?token=test-token"

    it("rewrites a relative join callback onto the gateway dashboard", () => {
      const input = `${verify}&callbackURL=%2Fexpert%2Frbarona%2Fsessions%2Fabc%2Fjoin`
      const rewritten = rewriteMagicLinkVerifyUrl(input, gateway)
      const callback = new URL(rewritten).searchParams.get("callbackURL")
      expect(callback).toBe(
        "http://localhost:3000/dashboard?returnTo=%2Fexpert%2Frbarona%2Fsessions%2Fabc%2Fjoin"
      )
    })

    it("keeps an already-gateway callbackURL stable", () => {
      const gatewayCallback = "http://localhost:3000/dashboard"
      const input = `${verify}&callbackURL=${encodeURIComponent(gatewayCallback)}`
      const rewritten = rewriteMagicLinkVerifyUrl(input, gateway)
      expect(new URL(rewritten).searchParams.get("callbackURL")).toBe(
        gatewayCallback
      )
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

describe("returning to the staff console", () => {
  it("names a console page by its path, behind the gateway's /dashboard", () => {
    expect(consoleReturnTo("/clinics/abc")).toBe(
      "/dashboard?console=%2Fclinics%2Fabc"
    )
    // The sign-in page keeps it as a gateway address.
    expect(
      toGatewayCallbackURL(
        consoleReturnTo("/clinics/abc"),
        "https://eleva.care"
      )
    ).toBe("https://eleva.care/dashboard?console=/clinics/abc")
    expect(
      toGatewayCallbackURL(
        consoleReturnTo("/clinics?page=2"),
        "https://eleva.care"
      )
    ).toBe("https://eleva.care/dashboard?console=/clinics?page=2")
  })

  it("takes a plain path, with one parameter at most", () => {
    for (const path of [
      "/",
      "/clinics",
      "/clinics/00000000-0000-4000-8000-000000000001",
      "/partners/abc_def-1.2~3",
      "/clinics?page=2",
    ]) {
      expect(consoleReturnPath(path), path).toBe(path)
    }
  })

  it("refuses anything that could name another place", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "clinics",
      "//evil.example",
      "/\\evil.example",
      "/clinics//evil.example",
      "https://evil.example/clinics",
      "/https://evil.example",
      "/clinics/../../x",
      "/..",
      "/clinics\tx",
      "/clinics x",
      "/clinics#top",
      "/clinics?next=https://evil.example",
      "/clinics?a=1&b=2",
      "/clinics?page=2?x",
      "/%2F%2Fevil.example",
      "/@evil.example",
      `/${"a".repeat(600)}`,
    ]) {
      expect(consoleReturnPath(raw), JSON.stringify(raw)).toBeUndefined()
    }
  })

  it("can only ever resolve on the console's own address", () => {
    const consoleUrl = "https://admin.eleva.care"
    for (const path of ["/", "/clinics/abc", "/clinics?page=2"]) {
      expect(new URL(consoleReturnPath(path)!, consoleUrl).origin).toBe(
        consoleUrl
      )
    }
  })
})
