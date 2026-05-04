import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

interface RbacConfig {
  version: number
  capabilities: Array<{ slug: string; displayName: string }>
  roles: Array<{ slug: string; displayName: string; capabilities: string[] }>
}

async function load(): Promise<RbacConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  return JSON.parse(await readFile(resolve(here, "rbac-config.json"), "utf8"))
}

describe("rbac-config.json", () => {
  it("capability slugs follow area[:subarea]:action shape", async () => {
    const config = await load()
    // Two- or three-segment colon-delimited slugs of lowercase
    // [a-z_]+. Three-segment is reserved for entity:subentity:action
    // patterns like 'expert:profile:edit'.
    for (const cap of config.capabilities) {
      expect(cap.slug).toMatch(/^[a-z_]+:[a-z_]+(:[a-z_]+)?$/)
      expect(cap.displayName.length).toBeGreaterThan(0)
    }
  })

  it("role slugs are snake_case and unique", async () => {
    const config = await load()
    const slugs = config.roles.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z_]+$/)
  })

  it("every role capability references a declared capability slug", async () => {
    const config = await load()
    const capSlugs = new Set(config.capabilities.map((c) => c.slug))
    for (const role of config.roles) {
      for (const cap of role.capabilities) {
        expect(capSlugs.has(cap), `${role.slug} \u2192 ${cap}`).toBe(true)
      }
    }
  })

  it("clinic_admin_capabilities strictly extends expert_capabilities", async () => {
    const config = await load()
    const expert = config.roles.find((r) => r.slug === "expert_capabilities")!
    const clinic = config.roles.find(
      (r) => r.slug === "clinic_admin_capabilities"
    )!
    for (const cap of expert.capabilities) {
      expect(clinic.capabilities).toContain(cap)
    }
    expect(clinic.capabilities.length).toBeGreaterThan(
      expert.capabilities.length
    )
  })

  it("patient bundle includes diary:share but no expert capabilities", async () => {
    const config = await load()
    const patient = config.roles.find((r) => r.slug === "patient_capabilities")!
    expect(patient.capabilities).toContain("diary:share")
    expect(patient.capabilities).not.toContain("events:manage")
    expect(patient.capabilities).not.toContain("reports:manage_own")
  })

  it("eleva_operator has audit:view_all + workflows:retry", async () => {
    const config = await load()
    const operator = config.roles.find(
      (r) => r.slug === "eleva_operator_capabilities"
    )!
    expect(operator.capabilities).toContain("audit:view_all")
    expect(operator.capabilities).toContain("workflows:retry")
    expect(operator.capabilities).toContain("payouts:approve")
  })
})
