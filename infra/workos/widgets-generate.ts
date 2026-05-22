import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import {
  createPermission,
  getEnvironmentRole,
  listAllPermissions,
  listEnvironmentRoles,
  parseCliEnv,
  resolveWorkosApiKey,
  setRolePermissions,
  updatePermission,
} from "./workos-api.js"
import {
  collectWidgetPermissionSlugs,
  diffPermissionSets,
  findMissingWidgetSlugs,
  mergeRoleWidgetPermissions,
  widgetPermissionMeta,
  widgetPermissionNeedsUpdate,
} from "./widget-permissions.js"

/**
 * widgets-generate — sync widget permission grants from widgets-config.json
 * onto WorkOS environment roles. Merges with existing app capabilities; does
 * not replace non-widgets permissions.
 *
 * Usage:
 *   pnpm widgets:generate              # dry-run
 *   pnpm widgets:generate --apply      # push to WorkOS (staging)
 *   pnpm widgets:generate --env=production --apply
 */

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

async function loadWidgetsConfig(): Promise<WidgetsConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, "widgets-config.json")
  return JSON.parse(await readFile(path, "utf8")) as WidgetsConfig
}

function validateConfig(config: WidgetsConfig): void {
  const widgetPermsFromWidgets = new Set(
    config.widgets.flatMap((w) => w.workosPermissions)
  )

  for (const [role, grants] of Object.entries(config.roleWidgetGrants)) {
    for (const grant of grants) {
      if (!grant.startsWith("widgets:")) {
        console.error(
          `[widgets] Role '${role}' grant '${grant}' must start with 'widgets:'.`
        )
        process.exit(1)
      }
      if (!widgetPermsFromWidgets.has(grant)) {
        console.error(
          `[widgets] Role '${role}' references '${grant}' not declared in any widget workosPermissions.`
        )
        process.exit(1)
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  let envName: string
  try {
    envName = parseCliEnv(args)
  } catch (err) {
    console.error(`[widgets] ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
  const { apiKey, apiKeyEnv } = resolveWorkosApiKey(envName)

  const config = await loadWidgetsConfig()
  validateConfig(config)

  const desiredByRole = config.roleWidgetGrants
  const requiredWidgetSlugs = collectWidgetPermissionSlugs(desiredByRole)

  console.log(
    `[widgets:${envName}] ${requiredWidgetSlugs.length} widget permission(s) across ${Object.keys(desiredByRole).length} role(s).`
  )

  if (!apply) {
    console.log("\n[widgets] DRY-RUN — pass --apply to push to WorkOS.\n")
    console.log("Widget permissions required in environment:")
    for (const slug of requiredWidgetSlugs) {
      const meta = widgetPermissionMeta(slug)
      console.log(`  • ${slug}`)
      console.log(`    name: ${meta.displayName}`)
      console.log(`    desc: ${meta.description}`)
    }
    console.log("\nRole grants to merge (keeps existing non-widgets perms):")
    for (const [role, grants] of Object.entries(desiredByRole)) {
      console.log(`  ${role}: ${grants.join(", ")}`)
    }
    return
  }

  if (!apiKey) {
    console.error(
      `[widgets] --apply requires ${apiKeyEnv} (or WORKOS_API_KEY as fallback) in env.`
    )
    process.exit(1)
  }

  console.log(`[widgets] Applying to WorkOS (${envName}) via ${apiKeyEnv}...\n`)

  console.log("[1/4] Ensuring widget permissions exist in WorkOS...")
  let allPerms = await listAllPermissions(apiKey)
  let permSlugs = new Set(allPerms.map((p) => p.slug))
  const missing = findMissingWidgetSlugs(requiredWidgetSlugs, permSlugs)
  if (missing.length > 0) {
    for (const slug of missing) {
      const meta = widgetPermissionMeta(slug)
      await createPermission(apiKey, slug, meta.displayName, meta.description)
      console.log(`  + created ${slug}`)
    }
    allPerms = await listAllPermissions(apiKey)
    permSlugs = new Set(allPerms.map((p) => p.slug))
    const stillMissing = findMissingWidgetSlugs(requiredWidgetSlugs, permSlugs)
    if (stillMissing.length > 0) {
      console.error("[widgets] Failed to create widget permissions:")
      for (const slug of stillMissing) console.error(`  ✗ ${slug}`)
      process.exit(1)
    }
  }

  let updated = 0
  for (const slug of requiredWidgetSlugs) {
    const live = allPerms.find((p) => p.slug === slug)
    if (!live || !widgetPermissionNeedsUpdate(live, slug)) continue
    if (live.system) {
      console.log(
        `  ⚠ ${slug}: WorkOS system permission — metadata is read-only in Dashboard`
      )
      continue
    }
    const meta = widgetPermissionMeta(slug)
    await updatePermission(apiKey, slug, meta.displayName, meta.description)
    updated++
    console.log(`  ↻ updated metadata for ${slug}`)
  }
  if (missing.length === 0 && updated === 0) {
    console.log(
      `  ✓ All ${requiredWidgetSlugs.length} widget permissions in sync`
    )
  }

  console.log("[2/4] Verifying target roles exist...")
  const roles = await listEnvironmentRoles(apiKey)
  const roleSlugs = new Set(roles.map((r) => r.slug))
  for (const role of Object.keys(desiredByRole)) {
    if (!roleSlugs.has(role)) {
      console.error(
        `[widgets] Role '${role}' not found in WorkOS. Run pnpm workos:rbac:generate -- --apply first.`
      )
      process.exit(1)
    }
  }
  console.log(`  ✓ ${Object.keys(desiredByRole).length} roles found`)

  console.log("[3/4] Merging widget grants into role permissions...")
  for (const [roleSlug, widgetGrants] of Object.entries(desiredByRole)) {
    const role = await getEnvironmentRole(apiKey, roleSlug)
    const current = role.permissions ?? []
    const merged = mergeRoleWidgetPermissions(current, widgetGrants)
    const { added, removed } = diffPermissionSets(current, merged)

    if (added.length === 0 && removed.length === 0) {
      console.log(`  ✓ ${roleSlug}: already in sync`)
      continue
    }

    await setRolePermissions(apiKey, roleSlug, merged)
    const parts: string[] = []
    if (added.length) parts.push(`+${added.join(", +")}`)
    if (removed.length) parts.push(`-${removed.join(", -")}`)
    console.log(`  ↻ ${roleSlug}: ${merged.length} total (${parts.join("; ")})`)
  }

  console.log("\n[4/4] Widget role grants synced.")
  console.log(
    "[widgets] CORS origins are not managed by this script — configure in WorkOS Dashboard → Authentication → CORS."
  )
}

main().catch((err) => {
  console.error("[widgets] Fatal error:", err)
  process.exit(1)
})
