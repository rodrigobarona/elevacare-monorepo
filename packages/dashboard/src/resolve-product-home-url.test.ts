import { afterEach, describe, expect, it, vi } from "vitest"
import {
  resolveAdminUrl,
  resolveProductHomeUrl,
} from "./resolve-product-home-url"

function homePath(session: Parameters<typeof resolveProductHomeUrl>[0]) {
  return new URL(resolveProductHomeUrl(session)).pathname
}

describe("resolveProductHomeUrl", () => {
  it("sends each workspace to its namespace (ADR-026)", () => {
    expect(homePath({ orgSlug: "space-abc123", productLabel: "member" })).toBe(
      "/space"
    )
    expect(homePath({ orgSlug: "patimota", productLabel: "expert" })).toBe(
      "/expert/patimota"
    )
    expect(
      homePath({ orgSlug: "clinica-mota", productLabel: "team_admin" })
    ).toBe("/team/clinica-mota")
    expect(homePath({ orgSlug: "pati-mota", productLabel: "lecturer" })).toBe(
      "/academy/pati-mota"
    )
  })

  it("sends a session with no workspace to /dashboard", () => {
    expect(homePath({ orgSlug: null, productLabel: "member" })).toBe(
      "/dashboard"
    )
  })
})

describe("resolveAdminUrl", () => {
  afterEach(() => vi.unstubAllEnvs())

  function stub(env: Record<string, string>) {
    for (const key of ["ADMIN_URL", "NEXT_PUBLIC_ADMIN_URL", "VERCEL_ENV"]) {
      vi.stubEnv(key, env[key] ?? "")
    }
  }

  it("uses ADMIN_URL when it is set", () => {
    stub({ ADMIN_URL: "https://admin.example.test", VERCEL_ENV: "production" })
    expect(resolveAdminUrl()).toBe("https://admin.example.test")
  })

  it("links deployed apps to the one staff console, never localhost", () => {
    stub({ VERCEL_ENV: "production" })
    expect(resolveAdminUrl()).toBe("https://admin.eleva.care")
    stub({ VERCEL_ENV: "preview" })
    expect(resolveAdminUrl()).toBe("https://admin.eleva.care")
  })

  it("falls back to the local admin port outside Vercel", () => {
    stub({})
    expect(resolveAdminUrl()).toBe("http://localhost:3007")
  })
})
