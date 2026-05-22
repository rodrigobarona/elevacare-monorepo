import { describe, expect, it } from "vitest"
import {
  isOrgSlugShape,
  LAST_ACTIVE_ORG_COOKIE,
  RESERVED_SLUGS,
} from "./routing"

describe("isOrgSlugShape", () => {
  it("accepts well-formed slugs", () => {
    expect(isOrgSlugShape("clinica-mota")).toBe(true)
    expect(isOrgSlugShape("acme")).toBe(true)
    expect(isOrgSlugShape("foo-bar-baz")).toBe(true)
    expect(isOrgSlugShape("a1b2c3")).toBe(true)
    expect(isOrgSlugShape("abc")).toBe(true)
  })

  it("rejects too short", () => {
    expect(isOrgSlugShape("ab")).toBe(false)
    expect(isOrgSlugShape("a")).toBe(false)
    expect(isOrgSlugShape("")).toBe(false)
  })

  it("rejects too long (>30 chars)", () => {
    expect(isOrgSlugShape("a".repeat(31))).toBe(false)
    expect(isOrgSlugShape("a".repeat(30))).toBe(true)
  })

  it("rejects uppercase", () => {
    expect(isOrgSlugShape("Clinica-Mota")).toBe(false)
    expect(isOrgSlugShape("ACME")).toBe(false)
  })

  it("rejects underscores, dots, spaces", () => {
    expect(isOrgSlugShape("foo_bar")).toBe(false)
    expect(isOrgSlugShape("foo.bar")).toBe(false)
    expect(isOrgSlugShape("foo bar")).toBe(false)
  })

  it("rejects leading/trailing hyphens", () => {
    expect(isOrgSlugShape("-foo")).toBe(false)
    expect(isOrgSlugShape("foo-")).toBe(false)
  })

  it("rejects consecutive hyphens", () => {
    expect(isOrgSlugShape("foo--bar")).toBe(false)
  })
})

describe("LAST_ACTIVE_ORG_COOKIE", () => {
  it("exports the stable cookie name", () => {
    expect(LAST_ACTIVE_ORG_COOKIE).toBe("eleva-last-org")
  })
})

describe("RESERVED_SLUGS - routing-critical entries", () => {
  it("includes all account standalone paths", () => {
    for (const slug of ["dashboard", "callback", "logout", "login", "signup"]) {
      expect(RESERVED_SLUGS.has(slug), `${slug} should be reserved`).toBe(true)
    }
  })

  it("includes fixed account segments", () => {
    for (const slug of ["onboarding", "account"]) {
      expect(RESERVED_SLUGS.has(slug), `${slug} should be reserved`).toBe(true)
    }
  })

  it("includes /admin and /docs", () => {
    expect(RESERVED_SLUGS.has("admin")).toBe(true)
    expect(RESERVED_SLUGS.has("docs")).toBe(true)
  })

  it("includes Next.js metadata convention routes", () => {
    for (const slug of [
      "icon",
      "apple-icon",
      "opengraph-image",
      "twitter-image",
      "sitemap",
      "robots",
      "manifest",
    ]) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true)
    }
  })

  it("includes infra paths", () => {
    for (const slug of ["api", "trpc", "_next", "_vercel"]) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true)
    }
  })

  it("does NOT include realistic org slugs", () => {
    expect(RESERVED_SLUGS.has("clinica-mota")).toBe(false)
    expect(RESERVED_SLUGS.has("patimota")).toBe(false)
  })
})
