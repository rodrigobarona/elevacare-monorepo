import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import {
  WorkosApiError,
  createPermission,
  createRole,
  deletePermission,
  listAllPermissions,
  listEnvironmentRoles,
  parseCliEnv,
  resolveWorkosApiKey,
  setRolePermissions,
  updateRole,
} from "./workos-api.js"

/**
 * rbac-generate — nuke-and-repave sync from infra/workos/rbac-config.json
 * to WorkOS. Re-creates capabilities and role assignments from the JSON
 * source of truth with proper descriptions.
 *
 * Usage:
 *   pnpm workos:rbac:generate              # dry-run (shows what would happen)
 *   pnpm workos:rbac:generate --apply      # actually call WorkOS API
 *   pnpm workos:rbac:generate --env=staging
 *   pnpm workos:rbac:generate --env=production --apply
 */

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

async function loadConfig(): Promise<RbacConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, "rbac-config.json")
  return JSON.parse(await readFile(path, "utf8")) as RbacConfig
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  let envName: string
  try {
    envName = parseCliEnv(args)
  } catch (err) {
    console.error(`[rbac] ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
  const { apiKey, apiKeyEnv } = resolveWorkosApiKey(envName)

  const config = await loadConfig()

  const capSlugs = config.capabilities.map((c) => c.slug)
  const roleSlugs = new Set(config.roles.map((r) => r.slug))

  for (const role of config.roles) {
    for (const cap of role.capabilities) {
      if (!capSlugs.includes(cap)) {
        console.error(
          `[rbac] Role '${role.slug}' references undefined capability '${cap}'.`
        )
        process.exit(1)
      }
    }
  }

  console.log(
    `[rbac:${envName}] ${capSlugs.length} capabilities, ${roleSlugs.size} roles.`
  )

  if (!apply) {
    console.log("\n[rbac] DRY-RUN — pass --apply to push to WorkOS.\n")
    console.log("Permissions to create:")
    for (const c of config.capabilities) {
      console.log(`  + ${c.slug}`)
      console.log(`    name: ${c.displayName}`)
      if (c.description) console.log(`    desc: ${c.description}`)
    }
    console.log("\nRoles to configure:")
    for (const r of config.roles) {
      console.log(
        `  ${r.slug} (${r.displayName}): ${r.capabilities.length} perms`
      )
      if (r.description) console.log(`    desc: ${r.description}`)
    }
    console.log(
      "\n[rbac] Widget grants are synced separately: pnpm workos:widgets:generate -- --apply"
    )
    return
  }

  if (!apiKey) {
    console.error(
      `[rbac] --apply requires ${apiKeyEnv} (or WORKOS_API_KEY as fallback) in env.`
    )
    process.exit(1)
  }

  console.log(`[rbac] Applying to WorkOS (${envName}) via ${apiKeyEnv}...\n`)

  // --- Step 1: Ensure all required roles exist ---
  console.log("[1/3] Ensuring required roles exist...")
  const existingRoles = await listEnvironmentRoles(apiKey)
  const currentRolesBySlug = new Map(existingRoles.map((r) => [r.slug, r]))

  for (const role of config.roles) {
    const liveRole = currentRolesBySlug.get(role.slug)
    if (liveRole) {
      const nameChanged = liveRole.name !== role.displayName
      const descChanged =
        (liveRole.description ?? "") !== (role.description ?? "")
      if (nameChanged || descChanged) {
        await updateRole(apiKey, role.slug, role.displayName, role.description)
        console.log(`  ↻ Updated '${role.slug}' (${role.displayName})`)
      } else {
        console.log(`  ✓ '${role.slug}' exists`)
      }
    } else {
      await createRole(apiKey, role.slug, role.displayName, role.description)
      console.log(`  + Created '${role.slug}' (${role.displayName})`)
    }
  }

  // --- Step 2: Delete all non-system permissions, recreate from config ---
  console.log("[2/3] Replacing permissions...")
  const existingPerms = await listAllPermissions(apiKey)
  let deleted = 0
  for (const perm of existingPerms) {
    if (perm.slug.startsWith("widgets:")) continue
    if (perm.system) continue
    try {
      await deletePermission(apiKey, perm.slug)
      deleted++
    } catch (err) {
      if (err instanceof WorkosApiError && err.status === 404) continue
      console.error(
        `[rbac] Failed to delete permission '${perm.slug}' (${apiKeyEnv}):`,
        err
      )
      throw err
    }
  }
  console.log(`  Deleted ${deleted} custom permissions`)

  let created = 0
  for (const cap of config.capabilities) {
    try {
      await createPermission(apiKey, cap.slug, cap.displayName, cap.description)
      created++
    } catch (err) {
      if (err instanceof WorkosApiError && err.status === 409) {
        console.log(`  ⚠ '${cap.slug}' already exists`)
      } else {
        throw err
      }
    }
  }
  console.log(`  Created ${created} permissions`)

  // --- Step 3: Assign permissions to roles ---
  console.log("[3/3] Assigning permissions to roles...")
  for (const role of config.roles) {
    await setRolePermissions(apiKey, role.slug, role.capabilities)
    console.log(`  ✓ ${role.slug}: ${role.capabilities.length} permissions`)
  }

  console.log("\n[rbac] Done! App capabilities synced.")
  console.warn(
    "\n[rbac] WARNING: rbac-generate clears widget grants from roles. You MUST run:\n" +
      "  pnpm workos:widgets:generate -- --apply\n" +
      "Widget access will be broken until widgets-generate completes."
  )
}

main().catch((err) => {
  console.error("[rbac] Fatal error:", err)
  process.exit(1)
})
