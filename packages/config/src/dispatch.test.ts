import { describe, expect, it } from "vitest"
import { isRootPath, resolveDispatch, type GatewayOrigins } from "./dispatch"

const origins: GatewayOrigins = {
  app: "http://app",
  expert: "http://expert",
  team: "http://team",
  academy: "http://academy",
  account: "http://account",
  docs: "http://docs",
}

describe("resolveDispatch - locale + marketing", () => {
  it("treats /pt, /es, /en as marketing", () => {
    for (const loc of ["/pt", "/es", "/en"]) {
      expect(resolveDispatch(loc, origins)).toEqual({
        kind: "marketing",
      })
    }
  })

  it("treats marketing paths as marketing", () => {
    for (const path of [
      "/about",
      "/pricing",
      "/blog",
      "/help",
      "/legal",
      "/home",
      "/experts",
      "/book/private-token",
      "/become-expert",
      "/for-clinics",
      "/contact",
      "/trust/security",
      "/community",
    ]) {
      expect(resolveDispatch(path, origins)).toEqual({
        kind: "marketing",
      })
    }
  })

  it("treats root as marketing", () => {
    expect(resolveDispatch("/", origins)).toEqual({ kind: "marketing" })
  })
})

describe("resolveDispatch - account zone", () => {
  it("rewrites /onboarding and /account/* to account origin (prefix match)", () => {
    expect(resolveDispatch("/onboarding", origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    expect(resolveDispatch("/onboarding/step-2", origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    expect(resolveDispatch("/account", origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    expect(resolveDispatch("/account/settings", origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
  })

  it("rewrites standalone /dashboard exactly, NOT /dashboard/foo", () => {
    expect(resolveDispatch("/dashboard", origins)).toEqual({
      kind: "rewrite",
      origin: "http://account",
    })
    // /dashboard/foo falls through to org-slug logic: "dashboard" is in
    // RESERVED_SLUGS so it cannot be an org slug -> marketing.
    expect(resolveDispatch("/dashboard/foo", origins)).toEqual({
      kind: "marketing",
    })
  })

  it("rewrites auth-flow standalones to account", () => {
    for (const path of [
      "/login",
      "/signup",
      "/callback",
      "/logout",
      "/verify-email",
      "/reset-password",
      "/two-factor",
      "/accept-invitation",
    ]) {
      expect(resolveDispatch(path, origins)).toEqual({
        kind: "rewrite",
        origin: "http://account",
      })
    }
  })
})

describe("resolveDispatch - docs zone", () => {
  it("rewrites /docs and /docs/* to docs origin (prefix match)", () => {
    expect(resolveDispatch("/docs", origins)).toEqual({
      kind: "rewrite",
      origin: "http://docs",
    })
    expect(resolveDispatch("/docs/guides/foo", origins)).toEqual({
      kind: "rewrite",
      origin: "http://docs",
    })
  })
})

describe("resolveDispatch - admin redirect", () => {
  it("returns admin-redirect for /admin and /admin/*", () => {
    expect(resolveDispatch("/admin", origins)).toEqual({
      kind: "admin-redirect",
    })
    expect(resolveDispatch("/admin/payments", origins)).toEqual({
      kind: "admin-redirect",
    })
  })
})

describe("resolveDispatch - public join grant path", () => {
  it("rewrites /join/{bookingId} to the member app", () => {
    const path = "/join/23fb39a9-71db-41c2-900e-ae422fd1b458"
    expect(resolveDispatch(path, origins)).toEqual({
      kind: "rewrite",
      origin: "http://app",
    })
  })
})

describe("resolveDispatch - workspace namespaces (ADR-026)", () => {
  it("dispatches /expert/* to the expert zone", () => {
    for (const path of [
      "/expert/patricia-mota-pt",
      "/expert/clinica-mota/calendar",
      "/expert/patricia-mota-pt/sessions/b1/join",
    ]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "rewrite",
        origin: "http://expert",
      })
    }
  })

  it("dispatches /space and its pages to the member app", () => {
    for (const path of [
      "/space",
      "/space/sessions",
      "/space/sessions/b1/join",
      "/space/reports/r1",
      "/space/settings",
    ]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "rewrite",
        origin: "http://app",
      })
    }
  })

  it("no longer serves dashboards under /:slug", () => {
    for (const path of [
      "/clinica-mota/team",
      "/space-3d4f155f88c8/sessions",
      "/clinica-mota/settings",
      "/clinica-mota/members/123",
    ]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "marketing",
      })
    }
  })
})

describe("resolveDispatch - team and academy namespaces", () => {
  it("dispatches /team/* to the team origin (clinic managers)", () => {
    for (const path of [
      "/team/clinica-mota",
      "/team/clinica-mota/notifications",
    ]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "rewrite",
        origin: "http://team",
      })
    }
  })

  it("dispatches /academy/* to the academy origin", () => {
    for (const path of ["/academy/pati-mota", "/academy/pati-mota/courses"]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "rewrite",
        origin: "http://academy",
      })
    }
  })

  it("no longer serves the clinic or academy under /:slug", () => {
    for (const path of [
      "/clinica-mota/admin",
      "/clinica-mota/academy/courses",
    ]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "marketing",
      })
    }
  })
})

describe("resolveDispatch - public profiles", () => {
  it("keeps /[username] and /[username]/[service] on marketing", () => {
    for (const path of ["/patimota", "/clinica-mota", "/anaquick/quick-chat"]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "marketing",
      })
    }
  })

  it("sends typos and reserved words to marketing", () => {
    for (const path of ["/ab", "/Foo-Bar", "/foo_bar", "/icon", "/robots"]) {
      expect(resolveDispatch(path, origins), path).toEqual({
        kind: "marketing",
      })
    }
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
