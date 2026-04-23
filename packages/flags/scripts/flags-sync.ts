/* eslint-disable no-console */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { FLAG_CATALOG } from "../src/catalog"

/**
 * flags:sync — pushes infra/flags/<env>.json to the Vercel Edge Config
 * store. Called manually by a reviewer after every PR that touches
 * flag values, in both staging and production.
 *
 * This script is intentionally a thin wrapper over `vercel edge-config`
 * semantics; it does NOT call the Vercel API directly. It:
 *   1. Loads the JSON file.
 *   2. Validates every key exists in the catalog (drift guard).
 *   3. Prints the items a reviewer should paste into the Vercel
 *      dashboard / edge-config CLI.
 *
 * Full automation (hit the Edge Config REST endpoint with a bearer)
 * lands in S7 once the CI secret is provisioned.
 */

async function main() {
  const envName = process.argv[2] ?? "staging"
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, `../../../infra/flags/${envName}.json`)
  const raw = await readFile(path, "utf8")
  const payload = JSON.parse(raw) as Record<string, boolean>

  const missing: string[] = []
  const extra: string[] = []
  const catalogNames = Object.keys(FLAG_CATALOG)
  for (const name of catalogNames) if (!(name in payload)) missing.push(name)
  for (const name of Object.keys(payload))
    if (!catalogNames.includes(name)) extra.push(name)

  if (extra.length > 0) {
    console.error(`Unknown flags in ${envName}.json:`, extra)
    process.exit(1)
  }
  if (missing.length > 0) {
    console.error(`Missing flags in ${envName}.json:`, missing)
    process.exit(1)
  }

  console.log(
    `[flags:sync] ${envName}.json validated. ${Object.keys(payload).length} flags.`
  )
  console.log("Copy the following into the Vercel Edge Config store:\n")
  console.log(JSON.stringify(payload, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
