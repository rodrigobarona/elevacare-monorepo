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

/** Expert-in-clinic bundle (workos_role = member in clinic org). */
const EXPERT_BUNDLE = [
  "events:manage",
  "schedule:manage",
  "bookings:manage_own",
  "reports:manage_own",
  "payouts:view_own",
  "expert:onboard",
  "expert:profile_edit",
  "expert:invoicing_manage",
] as const

/** Admin-context product labels from identity-rbac-spec (workos_role = admin). */
const ADMIN_CONTEXT_BUNDLES: Record<string, readonly string[]> = {
  /** Patient product label — not the WorkOS org-seniority role `member`. */
  patient: [
    "appointments:view_own",
    "sessions:view_own",
    "billing:view_own",
    "diary:share",
  ],
  expert: EXPERT_BUNDLE,
  team_admin: [
    ...EXPERT_BUNDLE,
    "members:manage",
    "billing:manage_org",
    "subscriptions:manage_org",
  ],
  lecturer: [
    "courses:manage",
    "courses:create",
    "courses:publish",
    "academy:analytics_view",
    "payouts:view_own",
  ],
  staff: [
    "experts:approve",
    "experts:reject",
    "applications:review",
    "applications:claim",
    "users:view_all",
    "payments:view_all",
    "payouts:approve",
    "audit:view_all",
    "workflows:retry",
    "accounting:reconcile",
    "usernames:reserve",
    "usernames:rename",
  ],
}

function unionAdminCapabilities(): Set<string> {
  const caps = new Set<string>()
  for (const bundle of Object.values(ADMIN_CONTEXT_BUNDLES)) {
    for (const cap of bundle) caps.add(cap)
  }
  return caps
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
        expect(capSlugs.has(cap), `${role.slug} → ${cap}`).toBe(true)
      }
    }
  })

  it("role descriptions fit WorkOS 150-character limit", async () => {
    const config = await load()
    for (const role of config.roles) {
      if (role.description) {
        expect(
          role.description.length,
          `${role.slug} description too long`
        ).toBeLessThanOrEqual(150)
      }
    }
  })

  it("only WorkOS org-seniority roles admin and member are configured", async () => {
    const config = await load()
    expect(config.roles.map((r) => r.slug).sort()).toEqual(["admin", "member"])
  })

  it("admin holds the deduped union of admin-context capability bundles", async () => {
    const config = await load()
    const admin = config.roles.find((r) => r.slug === "admin")!
    const expected = unionAdminCapabilities()
    expect(new Set(admin.capabilities)).toEqual(expected)
  })

  it("admin includes patient and staff capabilities", async () => {
    const config = await load()
    const admin = config.roles.find((r) => r.slug === "admin")!
    expect(admin.capabilities).toContain("diary:share")
    expect(admin.capabilities).toContain("audit:view_all")
    expect(admin.capabilities).toContain("events:manage")
  })

  it("member holds the expert-in-clinic bundle", async () => {
    const config = await load()
    const member = config.roles.find((r) => r.slug === "member")!
    expect(member.capabilities.sort()).toEqual([...EXPERT_BUNDLE].sort())
  })

  it("member does not include staff-only capabilities", async () => {
    const config = await load()
    const member = config.roles.find((r) => r.slug === "member")!
    expect(member.capabilities).not.toContain("audit:view_all")
    expect(member.capabilities).not.toContain("users:view_all")
  })
})
