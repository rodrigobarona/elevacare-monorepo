import { describe, expect, it } from "vitest"
import { catalogNames, defaultsMap, FLAG_CATALOG } from "./catalog"

describe("flag catalog", () => {
  it("every entry.name matches its record key", () => {
    for (const [key, entry] of Object.entries(FLAG_CATALOG)) {
      expect(entry.name).toBe(key)
    }
  })

  it("names follow ff.<area>[.<feature>] convention", () => {
    for (const name of catalogNames()) {
      expect(name).toMatch(/^ff\.[a-z_]+(\.[a-z_]+)?$/)
    }
  })

  it("every entry carries an owner + kill-switch description", () => {
    for (const entry of Object.values(FLAG_CATALOG)) {
      expect(entry.owner).toBeTruthy()
      expect(entry.killSwitchBehavior.length).toBeGreaterThan(5)
    }
  })

  it("dependsOn targets actually exist in the catalog", () => {
    const names = new Set(catalogNames())
    for (const entry of Object.values(FLAG_CATALOG)) {
      const deps = (entry as { dependsOn?: readonly string[] }).dependsOn ?? []
      for (const dep of deps) {
        expect(names.has(dep as never)).toBe(true)
      }
    }
  })

  it("phase-2 flags default off", () => {
    expect(FLAG_CATALOG["ff.three_party_revenue"].default).toBe(false)
    expect(FLAG_CATALOG["ff.ai_reports_beta"].default).toBe(false)
  })

  it("defaultsMap() reflects catalog defaults", () => {
    const defaults = defaultsMap()
    expect(defaults["ff.clinic_subscription_tiers"]).toBe(true)
    expect(defaults["ff.three_party_revenue"]).toBe(false)
  })
})
