import { describe, expect, it } from "vitest"
import { isRootPath, resolveDispatch, type GatewayOrigins } from "./dispatch"

const origins: GatewayOrigins = {
  app: "http://app",
  expert: "http://expert",
  team: "http://team",
  academy: "http://academy",
  account: "http://account",
}

describe("resolveDispatch - locale + marketing", () => {
  it("treats /pt, /es, /en as marketing", () => {
    for (const loc of ["/pt", "/es", "/en"]) {
      expect(resolveDispatch(loc, false, origins)).toEqual({
        kind: "marketing",
      })
      expect(resolveDispatch(loc, true, origins)).toEqual({
        kind: "marketing",
      })
    }
  })

  it("treats marketing paths as marketing regardless of session", () => {
    for (const path of [
      "/about",
      "/pricing",
      "/blog",
      "/help",
      "/legal",
      "/home",
    ]) {
      expect(resolveDispatch(path, false, origins)).toEqual({
        kind: "marketing",
      })
      expect(resolveDispatch(path, true, origins)).toEqual({
        kind: "marketing",
      })
    }
  })

  it("treats root as marketing", () => {
    expect(resolveDispatch("/", false, origins)).toEqual({ kind: "marketing" })
    expect(resolveDispatch("/", true, origins)).toEqual({ kind: "marketing" })
  })
})

describe("resolveDispatch - account zone", () => {
  it("rewrites /onboarding and /account/* to account origin (prefix match)", () => {
    expect(resolveDispatch("/onboarding", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    expect(resolveDispatch("/onboarding/step-2", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    expect(resolveDispatch("/account", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    expect(resolveDispatch("/account/settings", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
  })

  it("rewrites standalone /dashboard exactly, NOT /dashboard/foo", () => {
    expect(resolveDispatch("/dashboard", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    // /dashboard/foo falls through to org-slug logic: "dashboard" is in
    // RESERVED_SLUGS so it cannot be an org slug -> marketing.
    expect(resolveDispatch("/dashboard/foo", true, origins)).toEqual({
      kind: "marketing",
    })
  })

  it("rewrites auth-flow standalones to account", () => {
    for (const path of ["/login", "/signup", "/callback", "/logout"]) {
      expect(resolveDispatch(path, false, origins)).toEqual({
        kind: "rewrite",
        origin: "http://account",
      })
    }
  })
})

describe("resolveDispatch - app + admin", () => {
  it("rewrites /admin to the app origin (prefix match)", () => {
    expect(resolveDispatch("/admin", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://app",
    })
    expect(resolveDispatch("/admin/users", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://app",
    })
  })
})

describe("resolveDispatch - org-scoped second segment", () => {
  it("dispatches /:slug/expert to expert origin", () => {
    expect(
      resolveDispatch("/clinica-mota/expert/availability", true, origins)
    ).toEqual({ kind: "rewrite", origin: "http://expert" })
  })

  it("dispatches /:slug/team to team origin", () => {
    expect(resolveDispatch("/clinica-mota/team", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://team",
    })
  })

  it("dispatches /:slug/academy to academy origin", () => {
    expect(
      resolveDispatch("/clinica-mota/academy/courses", true, origins)
    ).toEqual({ kind: "rewrite", origin: "http://academy" })
  })

  it("dispatches /:slug/settings to app origin", () => {
    expect(resolveDispatch("/clinica-mota/settings", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://app",
    })
  })
})

describe("resolveDispatch - bare org slug", () => {
  it("rewrites /[orgSlug] to app origin when session present", () => {
    expect(resolveDispatch("/clinica-mota", true, origins)).toEqual({
      kind: "rewrite",
      origin: "http://app",
    })
  })

  it("returns unauth-slug for /[orgSlug] without a session", () => {
    expect(resolveDispatch("/clinica-mota", false, origins)).toEqual({
      kind: "unauth-slug",
      slug: "clinica-mota",
    })
  })

  it("rewrites deeper /[orgSlug]/[non-scoped]/[...] to app when authenticated", () => {
    expect(resolveDispatch("/clinica-mota/members/123", true, origins)).toEqual(
      { kind: "rewrite", origin: "http://app" }
    )
  })

  it("returns unauth-slug for deeper /[orgSlug]/[non-scoped]/[...] without session", () => {
    expect(
      resolveDispatch("/clinica-mota/members/123", false, origins)
    ).toEqual({ kind: "unauth-slug", slug: "clinica-mota" })
  })

  it("does NOT redirect typos that fail slug shape (too short)", () => {
    expect(resolveDispatch("/ab", false, origins)).toEqual({
      kind: "marketing",
    })
  })

  it("does NOT redirect typos that fail slug shape (invalid chars)", () => {
    expect(resolveDispatch("/Foo-Bar", false, origins)).toEqual({
      kind: "marketing",
    })
    expect(resolveDispatch("/foo_bar", false, origins)).toEqual({
      kind: "marketing",
    })
  })

  it("does NOT redirect reserved slugs", () => {
    // "members" is not actually reserved, but "icon" and "robots" are.
    expect(resolveDispatch("/icon", false, origins)).toEqual({
      kind: "marketing",
    })
    expect(resolveDispatch("/robots", false, origins)).toEqual({
      kind: "marketing",
    })
  })
})

describe("isRootPath", () => {
  it("recognizes /", () => {
    expect(isRootPath("/")).toBe(true)
  })

  it("recognizes /[locale] for known locales", () => {
    expect(isRootPath("/pt")).toBe(true)
    expect(isRootPath("/es")).toBe(true)
    expect(isRootPath("/en")).toBe(true)
    expect(isRootPath("/pt/")).toBe(true)
  })

  it("rejects /[unknownLocale]", () => {
    expect(isRootPath("/fr")).toBe(false)
  })

  it("rejects deeper paths", () => {
    expect(isRootPath("/pt/about")).toBe(false)
    expect(isRootPath("/clinica-mota")).toBe(false)
  })
})
