import { describe, expect, it } from "vitest"
import {
  collectWidgetPermissionSlugs,
  diffPermissionSets,
  findMissingWidgetSlugs,
  mergeRoleWidgetPermissions,
  widgetPermissionDescription,
  widgetPermissionDisplayName,
  widgetPermissionNeedsUpdate,
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
  it("uses catalog display names within 48 chars", () => {
    expect(widgetPermissionDisplayName("widgets:users-table:read")).toBe(
      "Read users (widget)"
    )
    expect(widgetPermissionDisplayName("widgets:users-table:manage")).toBe(
      "Manage users (widget)"
    )
    expect(
      widgetPermissionDisplayName("widgets:organization-switcher:read").length
    ).toBeLessThanOrEqual(48)
  })
})

describe("widgetPermissionDescription", () => {
  it("returns human-readable descriptions for managed widget slugs", () => {
    expect(widgetPermissionDescription("widgets:users-table:read")).toContain(
      "User Sessions"
    )
    expect(
      widgetPermissionDescription("widgets:organization-switcher:read")
    ).toContain("org switcher")
  })
})

describe("widgetPermissionNeedsUpdate", () => {
  it("detects name or description drift", () => {
    expect(
      widgetPermissionNeedsUpdate(
        { name: "Read users (widget)", description: "old" },
        "widgets:users-table:read"
      )
    ).toBe(true)
    expect(
      widgetPermissionNeedsUpdate(
        {
          name: "Read users (widget)",
          description: widgetPermissionDescription("widgets:users-table:read"),
        },
        "widgets:users-table:read"
      )
    ).toBe(false)
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
