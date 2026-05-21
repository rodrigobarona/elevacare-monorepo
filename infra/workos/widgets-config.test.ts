import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

interface WidgetsConfig {
  version: number
  widgets: Array<{
    component: string
    tokenScopes: string[]
    workosPermissions: string[]
    surfaces: string[]
  }>
  roleWidgetGrants: Record<string, string[]>
}

async function load(): Promise<WidgetsConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  return JSON.parse(
    await readFile(resolve(here, "widgets-config.json"), "utf8")
  )
}

describe("widgets-config.json", () => {
  it("widget components are unique", async () => {
    const config = await load()
    const names = config.widgets.map((w) => w.component)
    expect(new Set(names).size).toBe(names.length)
  })

  it("tokenScopes and workosPermissions match per widget", async () => {
    const config = await load()
    for (const widget of config.widgets) {
      expect(widget.tokenScopes).toEqual(widget.workosPermissions)
    }
  })

  it("account settings widgets never request users-table:manage", async () => {
    const config = await load()
    const accountWidgets = config.widgets.filter((w) =>
      w.surfaces.some((s) => s.includes("apps/account"))
    )
    for (const widget of accountWidgets) {
      expect(widget.tokenScopes).not.toContain("widgets:users-table:manage")
    }
  })

  it("UserSessions requires widgets:users-table:read", async () => {
    const config = await load()
    const sessions = config.widgets.find((w) => w.component === "UserSessions")!
    expect(sessions.tokenScopes).toEqual(["widgets:users-table:read"])
  })

  it("UsersManagement requires widgets:users-table:manage", async () => {
    const config = await load()
    const mgmt = config.widgets.find((w) => w.component === "UsersManagement")!
    expect(mgmt.tokenScopes).toEqual(["widgets:users-table:manage"])
  })

  it("roleWidgetGrants only reference permissions used by widgets", async () => {
    const config = await load()
    const allWidgetPerms = new Set(
      config.widgets.flatMap((w) => w.workosPermissions)
    )
    for (const [role, grants] of Object.entries(config.roleWidgetGrants)) {
      for (const perm of grants) {
        expect(
          allWidgetPerms.has(perm),
          `${role} grants unknown widget perm ${perm}`
        ).toBe(true)
      }
    }
  })

  it("admin and member roles grant users-table:read for account settings", async () => {
    const config = await load()
    expect(config.roleWidgetGrants.admin).toContain("widgets:users-table:read")
    expect(config.roleWidgetGrants.member).toContain("widgets:users-table:read")
  })

  it("role slugs align with rbac-config custom roles plus built-in admin", async () => {
    const config = await load()
    const rbac = JSON.parse(
      await readFile(
        resolve(dirname(fileURLToPath(import.meta.url)), "rbac-config.json"),
        "utf8"
      )
    ) as { roles: Array<{ slug: string }> }
    const rbacSlugs = new Set(rbac.roles.map((r) => r.slug))
    rbacSlugs.add("admin")
    for (const role of Object.keys(config.roleWidgetGrants)) {
      expect(rbacSlugs.has(role), `unknown role slug ${role}`).toBe(true)
    }
  })
})
