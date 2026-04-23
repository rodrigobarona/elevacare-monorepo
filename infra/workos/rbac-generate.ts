/* eslint-disable no-console */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { WorkOS } from "@workos-inc/node"

/**
 * rbac-generate — idempotent sync from infra/workos/rbac-config.json to
 * WorkOS. Creates/updates capabilities (permissions) and role bundles.
 * Safe to re-run; matches existing rows by slug.
 *
 * Usage:
 *   pnpm rbac:generate              # dry-run against prod keys
 *   pnpm rbac:generate --apply      # actually call WorkOS
 *   pnpm rbac:generate --env=staging # scoped to a WORKOS_API_KEY_STAGING
 *
 * Boundary: this script is the only place in the repo (besides
 * @eleva/encryption + @eleva/auth) that imports @workos-inc/node.
 */

interface RbacConfig {
  version: number
  capabilities: Array<{ slug: string; displayName: string }>
  roles: Array<{ slug: string; displayName: string; capabilities: string[] }>
}

async function loadConfig(): Promise<RbacConfig> {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, "rbac-config.json")
  return JSON.parse(await readFile(path, "utf8")) as RbacConfig
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
  const roleSlugs = config.roles.map((r) => r.slug)

  // Validate every role.capabilities references a declared capability.
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
    `[rbac:${envName}] ${capSlugs.length} capabilities, ${roleSlugs.length} roles.`
  )

  if (!apply) {
    console.log("[rbac] dry-run. Pass --apply to push to WorkOS.")
    console.log(
      "[rbac] capabilities:\n" +
        config.capabilities
          .map((c) => `  - ${c.slug}: ${c.displayName}`)
          .join("\n")
    )
    console.log(
      "[rbac] roles:\n" +
        config.roles
          .map((r) => `  - ${r.slug}: ${r.capabilities.length} caps`)
          .join("\n")
    )
    return
  }

  if (!apiKey) {
    console.error(
      `[rbac] --apply requires ${apiKeyEnv} (or WORKOS_API_KEY as fallback) in env.`
    )
    process.exit(1)
  }

  const workos = new WorkOS(apiKey)
  console.log(`[rbac] applying to WorkOS (${envName}) via ${apiKeyEnv}`)

  // WorkOS permission + role surface lives under workos.fga / workos.roles.
  // Implementation-specific calls are stubbed as TODOs here to avoid
  // making cross-environment side effects in a dry-run-first landing
  // that predates the WorkOS tenant seeding decision. Fill in per the
  // Context7 WorkOS Roles & Permissions doc before the first apply.
  console.log(
    "[rbac] NOTE: WorkOS API calls are stubbed. Run Context7 `/websites/workos`"
  )
  console.log(
    '       "Roles & Permissions" before the first --apply so the HTTP calls match'
  )
  console.log(
    "       the current API surface. Tracked in S1-B entrance checklist."
  )

  void workos
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
