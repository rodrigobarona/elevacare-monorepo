import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

interface RbacConfig {
  version: number
  capabilities: Array<{
    slug: string
    displayName: string
    description?: string
  }>
  roles: Array<{
    slug: string
    displayName: string
    description?: string
    capabilities: string[]
  }>
}

async function load(): Promise<RbacConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  return JSON.parse(await readFile(resolve(here, "rbac-config.json"), "utf8"))
}

describe("rbac-config.json", () => {
  it("capability slugs follow area:action shape (two segments)", async () => {
    const config = await load()
    for (const cap of config.capabilities) {
      expect(cap.slug).toMatch(/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/)
      expect(cap.displayName.length).toBeGreaterThan(0)
    }
  })

  it("role slugs are lowercase with hyphens/underscores and unique", async () => {
    const config = await load()
    const slugs = config.roles.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z][a-z0-9_-]*$/)
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

  it("team_admin strictly extends expert", async () => {
    const config = await load()
    const expert = config.roles.find((r) => r.slug === "expert")!
    const teamAdmin = config.roles.find((r) => r.slug === "team_admin")!
    for (const cap of expert.capabilities) {
      expect(teamAdmin.capabilities).toContain(cap)
    }
    expect(teamAdmin.capabilities.length).toBeGreaterThan(
      expert.capabilities.length
    )
  })

  it("member bundle includes diary:share but no expert capabilities", async () => {
    const config = await load()
    const member = config.roles.find((r) => r.slug === "member")!
    expect(member.capabilities).toContain("diary:share")
    expect(member.capabilities).not.toContain("events:manage")
    expect(member.capabilities).not.toContain("reports:manage_own")
  })

  it("staff has audit:view_all + workflows:retry", async () => {
    const config = await load()
    const staff = config.roles.find((r) => r.slug === "staff")!
    expect(staff.capabilities).toContain("audit:view_all")
    expect(staff.capabilities).toContain("workflows:retry")
    expect(staff.capabilities).toContain("payouts:approve")
  })

  it("lecturer has academy capabilities", async () => {
    const config = await load()
    const lecturer = config.roles.find((r) => r.slug === "lecturer")!
    expect(lecturer.capabilities).toContain("courses:manage")
    expect(lecturer.capabilities).toContain("courses:publish")
    expect(lecturer.capabilities).toContain("academy:analytics_view")
  })

  it("all expected roles exist", async () => {
    const config = await load()
    const slugs = config.roles.map((r) => r.slug)
    expect(slugs).toContain("member")
    expect(slugs).toContain("expert")
    expect(slugs).toContain("team_admin")
    expect(slugs).toContain("lecturer")
    expect(slugs).toContain("staff")
  })
})
