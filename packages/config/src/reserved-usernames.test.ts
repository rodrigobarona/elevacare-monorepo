import { describe, expect, it } from "vitest"
import {
  isReserved,
  RESERVED_USERNAMES,
  validateUsername,
} from "./reserved-usernames"

describe("reserved usernames", () => {
  it("covers every gateway first-segment path", () => {
    for (const slug of [
      "patient",
      "expert",
      "org",
      "admin",
      "settings",
      "callback",
      "logout",
      "docs",
      "home",
      "signin",
      "signup",
    ]) {
      expect(isReserved(slug), `${slug} should be reserved`).toBe(true)
    }
  })

  it("covers locale codes", () => {
    for (const loc of ["pt", "en", "es", "br"]) {
      expect(isReserved(loc)).toBe(true)
    }
  })

  it("covers branded subresources (would collide with subdomain hygiene)", () => {
    for (const slug of [
      "api",
      "app",
      "www",
      "mail",
      "status",
      "sessions",
      "email",
    ]) {
      expect(isReserved(slug)).toBe(true)
    }
  })

  it("is case-insensitive", () => {
    expect(isReserved("PATIENT")).toBe(true)
    expect(isReserved("Api")).toBe(true)
  })

  it("permits a realistic expert username", () => {
    expect(isReserved("patimota")).toBe(false)
    expect(isReserved("clinica-mota")).toBe(false)
  })

  it("exports a ReadonlySet", () => {
    expect(RESERVED_USERNAMES instanceof Set).toBe(true)
    expect(RESERVED_USERNAMES.size).toBeGreaterThan(30)
  })
})

describe("validateUsername", () => {
  it("accepts well-formed names", () => {
    expect(validateUsername("patimota")).toBeNull()
    expect(validateUsername("clinica-mota")).toBeNull()
    expect(validateUsername("abc")).toBeNull()
    expect(validateUsername("a1-b2-c3")).toBeNull()
  })

  it("rejects too short", () => {
    expect(validateUsername("ab")).toBe("too-short")
  })

  it("rejects too long", () => {
    expect(validateUsername("a".repeat(31))).toBe("too-long")
  })

  it("rejects invalid characters", () => {
    expect(validateUsername("pati.mota")).toBe("invalid-chars")
    expect(validateUsername("pati_mota")).toBe("invalid-chars")
    expect(validateUsername("pati mota")).toBe("invalid-chars")
  })

  it("rejects leading/trailing hyphens", () => {
    expect(validateUsername("-pati")).toBe("leading-hyphen")
    expect(validateUsername("pati-")).toBe("trailing-hyphen")
  })

  it("rejects consecutive hyphens", () => {
    expect(validateUsername("pati--mota")).toBe("consecutive-hyphens")
  })

  it("rejects reserved names", () => {
    expect(validateUsername("patient")).toBe("reserved")
    expect(validateUsername("admin")).toBe("reserved")
  })

  it("normalises case before checking reserved list", () => {
    expect(validateUsername("ADMIN")).toBe("reserved")
  })
})
