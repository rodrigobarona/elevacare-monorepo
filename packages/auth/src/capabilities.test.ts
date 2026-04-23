import { describe, expect, it } from "vitest"
import {
  capabilitiesFor,
  CAPABILITY_BUNDLES,
  deriveProductLabel,
  hasCapability,
} from "./capabilities"

describe("deriveProductLabel", () => {
  it("personal + admin = patient", () => {
    expect(deriveProductLabel("personal", "admin")).toBe("patient")
  })
  it("solo_expert + admin = expert", () => {
    expect(deriveProductLabel("solo_expert", "admin")).toBe("expert")
  })
  it("clinic + admin = clinic_admin", () => {
    expect(deriveProductLabel("clinic", "admin")).toBe("clinic_admin")
  })
  it("clinic + member = expert", () => {
    expect(deriveProductLabel("clinic", "member")).toBe("expert")
  })
  it("eleva_operator always = eleva_operator regardless of role", () => {
    expect(deriveProductLabel("eleva_operator", "admin")).toBe("eleva_operator")
    expect(deriveProductLabel("eleva_operator", "member")).toBe(
      "eleva_operator"
    )
  })
  it("rejects unsupported tuples", () => {
    expect(() => deriveProductLabel("personal", "member")).toThrow()
    expect(() => deriveProductLabel("solo_expert", "member")).toThrow()
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

  it("clinic_admin strictly extends expert", () => {
    for (const cap of CAPABILITY_BUNDLES.expert) {
      expect(CAPABILITY_BUNDLES.clinic_admin).toContain(cap)
    }
    expect(CAPABILITY_BUNDLES.clinic_admin.length).toBeGreaterThan(
      CAPABILITY_BUNDLES.expert.length
    )
  })

  it("patient has diary:share but no expert caps", () => {
    expect(CAPABILITY_BUNDLES.patient).toContain("diary:share")
    expect(CAPABILITY_BUNDLES.patient).not.toContain("events:manage")
  })

  it("eleva_operator has audit:view_all + workflows:retry", () => {
    expect(CAPABILITY_BUNDLES.eleva_operator).toContain("audit:view_all")
    expect(CAPABILITY_BUNDLES.eleva_operator).toContain("workflows:retry")
  })

  it("capabilitiesFor returns the matching bundle", () => {
    expect(capabilitiesFor("patient")).toEqual(CAPABILITY_BUNDLES.patient)
  })

  it("hasCapability checks membership", () => {
    expect(hasCapability(CAPABILITY_BUNDLES.expert, "events:manage")).toBe(true)
    expect(hasCapability(CAPABILITY_BUNDLES.expert, "audit:view_all")).toBe(
      false
    )
  })
})
