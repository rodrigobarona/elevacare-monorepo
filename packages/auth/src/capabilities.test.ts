import { describe, expect, it } from "vitest"
import {
  capabilitiesFor,
  CAPABILITY_BUNDLES,
  deriveProductLabel,
  hasCapability,
} from "./capabilities"

describe("deriveProductLabel", () => {
  it("personal + admin = member", () => {
    expect(deriveProductLabel("personal", "admin")).toBe("member")
  })
  it("expert + admin = expert", () => {
    expect(deriveProductLabel("expert", "admin")).toBe("expert")
  })
  it("team + admin = team_admin", () => {
    expect(deriveProductLabel("team", "admin")).toBe("team_admin")
  })
  it("team + member = expert", () => {
    expect(deriveProductLabel("team", "member")).toBe("expert")
  })
  it("staff always = staff regardless of role", () => {
    expect(deriveProductLabel("staff", "admin")).toBe("staff")
    expect(deriveProductLabel("staff", "member")).toBe("staff")
  })
  it("rejects unsupported tuples", () => {
    expect(() => deriveProductLabel("personal", "member")).toThrow()
    expect(() => deriveProductLabel("expert", "member")).toThrow()
  })
})

describe("capability bundles", () => {
  it("every label has at least one capability", () => {
    for (const label of Object.keys(CAPABILITY_BUNDLES) as Array<
      keyof typeof CAPABILITY_BUNDLES
    >) {
      expect(CAPABILITY_BUNDLES[label].length).toBeGreaterThan(0)
    }
  })

  it("team_admin strictly extends expert", () => {
    for (const cap of CAPABILITY_BUNDLES.expert) {
      expect(CAPABILITY_BUNDLES.team_admin).toContain(cap)
    }
    expect(CAPABILITY_BUNDLES.team_admin.length).toBeGreaterThan(
      CAPABILITY_BUNDLES.expert.length
    )
  })

  it("member has diary:share but no expert caps", () => {
    expect(CAPABILITY_BUNDLES.member).toContain("diary:share")
    expect(CAPABILITY_BUNDLES.member).not.toContain("events:manage")
  })

  it("staff has audit:view_all + workflows:retry", () => {
    expect(CAPABILITY_BUNDLES.staff).toContain("audit:view_all")
    expect(CAPABILITY_BUNDLES.staff).toContain("workflows:retry")
  })

  it("capabilitiesFor returns the matching bundle", () => {
    expect(capabilitiesFor("member")).toEqual(CAPABILITY_BUNDLES.member)
  })

  it("hasCapability checks membership", () => {
    expect(hasCapability(CAPABILITY_BUNDLES.expert, "events:manage")).toBe(true)
    expect(hasCapability(CAPABILITY_BUNDLES.expert, "audit:view_all")).toBe(
      false
    )
  })
})
