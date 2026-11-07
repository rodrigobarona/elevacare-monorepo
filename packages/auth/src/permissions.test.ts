import { describe, expect, it } from "vitest"
import {
  ac,
  admin,
  adminRoles,
  member,
  organizationRoles,
  owner,
  statement,
} from "./permissions"

describe("permissions", () => {
  it("exposes organization statements used by createAccessControl", () => {
    expect(statement.organization).toContain("create")
    expect(statement.member).toContain("delete")
    expect(statement.adminUser).toContain("set-role")
  })

  it("grants owner every org mutation", () => {
    expect(owner.authorize({ organization: ["delete"] }).success).toBe(true)
    expect(admin.authorize({ organization: ["delete"] }).success).toBe(false)
    expect(member.authorize({ booking: ["view"] }).success).toBe(true)
    expect(member.authorize({ billing: ["manage"] }).success).toBe(false)
  })

  it("registers platform_admin for the admin plugin", () => {
    expect(adminRoles.platform_admin).toBeDefined()
    expect(organizationRoles.owner).toBe(owner)
    expect(ac).toBeDefined()
  })

  it("never lets a staff role impersonate or take over an account", () => {
    const takeover = [
      "impersonate",
      "impersonate-admins",
      "set-password",
      "set-email",
      "set-phone",
      "delete",
      "update",
    ] as const
    for (const [role, rules] of Object.entries(adminRoles)) {
      for (const action of takeover) {
        expect(
          rules.authorize({ user: [action] }).success,
          `${role} must not ${action}`
        ).toBe(false)
      }
    }
  })

  it("keeps support and finance read-only; only platform_admin grants roles", () => {
    for (const role of ["staff_support", "staff_finance"] as const) {
      const rules = adminRoles[role]
      expect(rules.authorize({ user: ["list"] }).success).toBe(true)
      expect(rules.authorize({ user: ["set-role"] }).success).toBe(false)
      expect(rules.authorize({ user: ["ban"] }).success).toBe(false)
      expect(rules.authorize({ session: ["revoke"] }).success).toBe(false)
    }
    expect(
      adminRoles.platform_admin.authorize({ user: ["set-role"] }).success
    ).toBe(true)
  })
})
