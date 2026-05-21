/**
 * Pure helpers for merging WorkOS widget permissions into role assignments.
 */

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

/** Human-readable permission name for WorkOS (max 48 chars). */
export function widgetPermissionDisplayName(slug: string): string {
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
  return `WorkOS Widgets permission (${slug}) synced from infra/workos/widgets-config.json`
}

export function findMissingWidgetSlugs(
  required: readonly string[],
  existingSlugs: ReadonlySet<string>
): string[] {
  return required.filter((slug) => !existingSlugs.has(slug))
}
