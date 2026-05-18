 
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

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

const WORKOS_API_BASE = "https://api.workos.com"

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

interface WorkOSPermission {
  slug: string
  name: string
  description?: string
}

interface WorkOSRole {
  slug: string
  name: string
  description?: string
  type?: string
}

async function loadConfig(): Promise<RbacConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, "rbac-config.json")
  return JSON.parse(await readFile(path, "utf8")) as RbacConfig
}

async function workosRequest<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${WORKOS_API_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WorkOS ${method} ${path} → ${res.status}: ${text}`)
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return {} as T
  }

  return res.json() as Promise<T>
}

async function listAllPermissions(apiKey: string): Promise<WorkOSPermission[]> {
  const all: WorkOSPermission[] = []
  let after: string | undefined

  while (true) {
    const params = new URLSearchParams({ limit: "100" })
    if (after) params.set("after", after)

    const res = await workosRequest<{
      data: WorkOSPermission[]
      list_metadata: { after: string | null }
    }>(apiKey, "GET", `/authorization/permissions?${params}`)

    all.push(...res.data)
    if (!res.list_metadata.after) break
    after = res.list_metadata.after
  }

  return all
}

async function listEnvironmentRoles(apiKey: string): Promise<WorkOSRole[]> {
  const res = await workosRequest<{ data: WorkOSRole[] }>(
    apiKey,
    "GET",
    "/authorization/roles"
  )
  return res.data
}

async function deletePermission(apiKey: string, slug: string): Promise<void> {
  await workosRequest(apiKey, "DELETE", `/authorization/permissions/${slug}`)
}

async function deleteRole(apiKey: string, slug: string): Promise<void> {
  await workosRequest(apiKey, "DELETE", `/authorization/roles/${slug}`)
}

async function createPermission(
  apiKey: string,
  slug: string,
  name: string,
  description?: string
): Promise<void> {
  await workosRequest(apiKey, "POST", "/authorization/permissions", {
    slug,
    name,
    ...(description && { description }),
  })
}

async function createRole(
  apiKey: string,
  slug: string,
  name: string,
  description?: string
): Promise<void> {
  await workosRequest(apiKey, "POST", "/authorization/roles", {
    slug,
    name,
    ...(description && { description }),
  })
}

async function setRolePermissions(
  apiKey: string,
  roleSlug: string,
  permissions: string[]
): Promise<void> {
  await workosRequest(
    apiKey,
    "PUT",
    `/authorization/roles/${roleSlug}/permissions`,
    { permissions }
  )
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const envArg = args.find((a) => a.startsWith("--env="))
  const envName = envArg?.split("=")[1] ?? "staging"

  const apiKeyEnv =
    envName === "production" ? "WORKOS_API_KEY_PRODUCTION" : "WORKOS_API_KEY"
  const apiKey = process.env[apiKeyEnv] ?? process.env.WORKOS_API_KEY

  const config = await loadConfig()

  const capSlugs = config.capabilities.map((c) => c.slug)
  const roleSlugs = new Set(config.roles.map((r) => r.slug))

  for (const role of config.roles) {
    for (const cap of role.capabilities) {
      if (!capSlugs.includes(cap)) {
        console.error(
          `Role '${role.slug}' references undefined capability '${cap}'.`
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

  // --- Step 2: Ensure all required roles exist (create missing) ---
  console.log("[2/5] Ensuring required roles exist...")
  const rolesAfterCleanup = await listEnvironmentRoles(apiKey)
  const currentRoleSlugs = new Set(rolesAfterCleanup.map((r) => r.slug))

  for (const role of config.roles) {
    if (currentRoleSlugs.has(role.slug)) {
      console.log(`  ✓ '${role.slug}' exists`)
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

  console.log("\n[rbac] Done! Roles & permissions fully synced.")
}

main().catch((err) => {
  console.error("[rbac] Fatal error:", err)
  process.exit(1)
})
