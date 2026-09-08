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
})
