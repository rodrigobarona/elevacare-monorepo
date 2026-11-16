import { describe, expect, it } from "vitest"
import { resolveProductHomeUrl } from "./resolve-product-home-url"

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
