import { describe, expect, it } from "vitest"
import {
  collectWidgetPermissionSlugs,
  diffPermissionSets,
  findMissingWidgetSlugs,
  mergeRoleWidgetPermissions,
  widgetPermissionDisplayName,
} from "./widget-permissions"

describe("mergeRoleWidgetPermissions", () => {
  it("preserves app capabilities and replaces widget layer", () => {
    const merged = mergeRoleWidgetPermissions(
      [
        "appointments:view_own",
        "widgets:users-table:manage",
        "widgets:organization-switcher:read",
      ],
      ["widgets:users-table:read"]
    )
    expect(merged).toEqual([
      "appointments:view_own",
      "widgets:users-table:read",
    ])
  })

  it("deduplicates widget grants", () => {
    const merged = mergeRoleWidgetPermissions(
      ["widgets:users-table:read"],
      ["widgets:users-table:read", "widgets:users-table:read"]
    )
    expect(merged).toEqual(["widgets:users-table:read"])
  })
})

describe("diffPermissionSets", () => {
  it("reports added and removed slugs", () => {
    const diff = diffPermissionSets(
      ["a:one", "widgets:old"],
      ["a:one", "widgets:new"]
    )
    expect(diff.added).toEqual(["widgets:new"])
    expect(diff.removed).toEqual(["widgets:old"])
  })
})

describe("collectWidgetPermissionSlugs", () => {
  it("returns unique sorted widget slugs", () => {
    const slugs = collectWidgetPermissionSlugs({
      admin: ["widgets:users-table:read", "widgets:organization-switcher:read"],
      member: ["widgets:users-table:read"],
    })
    expect(slugs).toEqual([
      "widgets:organization-switcher:read",
      "widgets:users-table:read",
    ])
  })
})

describe("widgetPermissionDisplayName", () => {
  it("formats read and manage slugs within 48 chars", () => {
    expect(widgetPermissionDisplayName("widgets:users-table:read")).toBe(
      "Read Users Table (widget)"
    )
    expect(widgetPermissionDisplayName("widgets:users-table:manage")).toBe(
      "Manage Users Table (widget)"
    )
    expect(
      widgetPermissionDisplayName("widgets:organization-switcher:read").length
    ).toBeLessThanOrEqual(48)
  })
})

describe("findMissingWidgetSlugs", () => {
  it("returns slugs not in the environment", () => {
    const missing = findMissingWidgetSlugs(
      ["widgets:users-table:read", "widgets:users-table:manage"],
      new Set(["widgets:users-table:manage"])
    )
    expect(missing).toEqual(["widgets:users-table:read"])
  })
})
