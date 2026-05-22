/**
 * Pure helpers for merging WorkOS widget permissions into role assignments.
 */

export interface WidgetPermissionMeta {
  displayName: string
  description: string
}

/** Eleva-managed WorkOS widget permissions (from widgets-config.json). */
export const WIDGET_PERMISSION_CATALOG: Record<string, WidgetPermissionMeta> = {
  "widgets:users-table:read": {
    displayName: "Read users (widget)",
    description:
      "View session and device sign-in data in account settings (User Sessions widget).",
  },
  "widgets:users-table:manage": {
    displayName: "Manage users (widget)",
    description:
      "Invite, remove, and update org members via the Users Management widget.",
  },
  "widgets:organization-switcher:read": {
    displayName: "Read organization switcher (widget)",
    description:
      "List and switch between organization memberships in the org switcher.",
  },
}

/** Remove all widgets:* slugs, then append the desired widget grant set. */
export function mergeRoleWidgetPermissions(
  currentPermissions: readonly string[],
  desiredWidgetPermissions: readonly string[]
): string[] {
  const appPermissions = currentPermissions.filter(
    (slug) => !slug.startsWith("widgets:")
  )
  return [...new Set([...appPermissions, ...desiredWidgetPermissions])].sort()
}

export function diffPermissionSets(
  before: readonly string[],
  after: readonly string[]
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  const added = [...afterSet].filter((p) => !beforeSet.has(p)).sort()
  const removed = [...beforeSet].filter((p) => !afterSet.has(p)).sort()
  return { added, removed }
}

export function collectWidgetPermissionSlugs(
  roleWidgetGrants: Record<string, string[]>
): string[] {
  return [...new Set(Object.values(roleWidgetGrants).flat())].sort()
}

export function widgetPermissionMeta(slug: string): WidgetPermissionMeta {
  const catalog = WIDGET_PERMISSION_CATALOG[slug]
  if (catalog) return catalog
  return {
    displayName: widgetPermissionDisplayName(slug),
    description: `WorkOS Widgets permission (${slug}) synced from infra/workos/widgets-config.json`,
  }
}

/** Human-readable permission name for WorkOS (max 48 chars). */
export function widgetPermissionDisplayName(slug: string): string {
  const catalog = WIDGET_PERMISSION_CATALOG[slug]
  if (catalog) return catalog.displayName

  const match = /^widgets:([a-z0-9-]+):(read|manage)$/.exec(slug)
  if (!match) return slug.slice(0, 48)

  const [, resource, action] = match
  const title = resource
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  const name =
    action === "manage" ? `Manage ${title} (widget)` : `Read ${title} (widget)`

  return name.length <= 48 ? name : name.slice(0, 48)
}

export function widgetPermissionDescription(slug: string): string {
  return widgetPermissionMeta(slug).description
}

export function widgetPermissionNeedsUpdate(
  live: { name: string; description?: string },
  slug: string
): boolean {
  const desired = widgetPermissionMeta(slug)
  return (
    live.name !== desired.displayName ||
    (live.description ?? "") !== desired.description
  )
}

export function findMissingWidgetSlugs(
  required: readonly string[],
  existingSlugs: ReadonlySet<string>
): string[] {
  return required.filter((slug) => !existingSlugs.has(slug))
}
