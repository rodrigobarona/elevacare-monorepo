import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import {
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  listAllPermissions,
  listEnvironmentRoles,
  parseCliEnv,
  resolveWorkosApiKey,
  setRolePermissions,
  updateRole,
} from "./workos-api.js"

/**
 * rbac-generate — nuke-and-repave sync from infra/workos/rbac-config.json
 * to WorkOS. Deletes stale roles/permissions and re-creates everything from
 * the JSON source of truth with proper descriptions.
 *
 * Usage:
 *   pnpm rbac:generate              # dry-run (shows what would happen)
 *   pnpm rbac:generate --apply      # actually call WorkOS API
 *   pnpm rbac:generate --env=staging
 *   pnpm rbac:generate --env=production --apply
 */

const PROTECTED_ROLE_SLUGS = new Set(["admin", "member"])

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
  const envName = parseCliEnv(args)
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
      "\n[rbac] Widget grants are synced separately: pnpm widgets:generate -- --apply"
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

  // --- Step 1: Delete stale roles not in our config ---
  console.log("[1/5] Cleaning up stale roles...")
  const existingRoles = await listEnvironmentRoles(apiKey)
  let staleDeleted = 0
  for (const role of existingRoles) {
    if (PROTECTED_ROLE_SLUGS.has(role.slug)) continue
    if (role.slug.startsWith("widgets:")) continue
    if (roleSlugs.has(role.slug)) continue

    try {
      await setRolePermissions(apiKey, role.slug, [])
      await deleteRole(apiKey, role.slug)
      console.log(`  ✗ Deleted stale role '${role.slug}'`)
      staleDeleted++
    } catch (err) {
      console.log(
        `  ⚠ Could not delete '${role.slug}' (${err instanceof Error ? err.message : err})`
      )
    }
  }
  if (staleDeleted === 0) console.log("  (no stale roles found)")

  // --- Step 2: Ensure all required roles exist (create missing, update stale) ---
  console.log("[2/5] Ensuring required roles exist...")
  const rolesAfterCleanup = await listEnvironmentRoles(apiKey)
  const currentRolesBySlug = new Map(rolesAfterCleanup.map((r) => [r.slug, r]))

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

  // --- Step 3: Clear permissions on all managed roles ---
  console.log("[3/5] Clearing permissions on all managed roles...")
  for (const role of config.roles) {
    await setRolePermissions(apiKey, role.slug, [])
  }
  console.log(`  ✓ Cleared ${config.roles.length} roles`)

  // --- Step 4: Delete all non-system permissions, recreate from config ---
  console.log("[4/5] Replacing permissions...")
  const existingPerms = await listAllPermissions(apiKey)
  let deleted = 0
  for (const perm of existingPerms) {
    if (perm.slug.startsWith("widgets:")) continue
    try {
      await deletePermission(apiKey, perm.slug)
      deleted++
    } catch {
      // ignore
    }
  }
  console.log(`  Deleted ${deleted} custom permissions`)

  let created = 0
  for (const cap of config.capabilities) {
    try {
      await createPermission(apiKey, cap.slug, cap.displayName, cap.description)
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("409") || msg.includes("already exists")) {
        console.log(`  ⚠ '${cap.slug}' already exists`)
      } else {
        throw err
      }
    }
  }
  console.log(`  Created ${created} permissions`)

  // --- Step 5: Assign permissions to roles ---
  console.log("[5/5] Assigning permissions to roles...")
  for (const role of config.roles) {
    await setRolePermissions(apiKey, role.slug, role.capabilities)
    console.log(`  ✓ ${role.slug}: ${role.capabilities.length} permissions`)
  }

  console.log("\n[rbac] Done! App capabilities synced.")
  console.log(
    "[rbac] Next: pnpm widgets:generate -- --apply  (widget grants; preserves app perms on merge)"
  )
}

main().catch((err) => {
  console.error("[rbac] Fatal error:", err)
  process.exit(1)
})
