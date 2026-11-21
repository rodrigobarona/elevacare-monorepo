#!/usr/bin/env node
/**
 * CI guard (Phase 14): the MVP migration tools stay on their own.
 *
 * `infra/migration` is a temporary package that will hold the only code
 * allowed to read the MVP database and the previous identity provider's
 * vault. Nothing that ships (apps/**, packages/**) may import it, by its
 * package name or by path, so removing it after cutover (Phase 16.16)
 * cannot break the product. The internal playground (`apps/poc`) is left
 * out, as it is from every CI check (AGENTS.md).
 */
import { realpathSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = path.resolve(import.meta.dirname, "..")
const SCANNED = ["apps", "packages"]
/** Workspace folders no CI check reads. */
const EXCLUDED = new Set(["apps/poc"])
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const SKIP = new Set(["node_modules", ".next", "dist", ".turbo", "coverage"])
const DEPENDENCY_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "devDependencies",
  "peerDependencies",
]
/** `from "…"`, `import("…")`, `require("…")` naming the package or its folder. */
const IMPORT =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["'`]([^"'`]*(?:@eleva\/infra-migration|infra\/migration)[^"'`]*)["'`]/g

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, files)
    else if (SOURCE.test(entry.name)) files.push(full)
  }
  return files
}

/** The workspace folders under `root` that ship: apps/* and packages/*. */
async function workspaces(root) {
  const found = []
  for (const top of SCANNED) {
    const entries = await readdir(path.join(root, top), {
      withFileTypes: true,
    }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory() || EXCLUDED.has(`${top}/${entry.name}`)) continue
      found.push(path.join(root, top, entry.name))
    }
  }
  return found
}

/** Checks the repository at `root`. Exported for the test. */
export async function findMigrationImportProblems(root = ROOT) {
  const problems = []
  let scanned = 0
  for (const workspace of await workspaces(root)) {
    for (const file of await walk(workspace)) {
      scanned += 1
      const source = await readFile(file, "utf8")
      for (const match of source.matchAll(IMPORT)) {
        problems.push(`${path.relative(root, file)} imports "${match[1]}"`)
      }
    }
    // A dependency entry would let an import through later: refuse it too.
    const manifest = path.join(workspace, "package.json")
    let parsed
    try {
      parsed = JSON.parse(await readFile(manifest, "utf8"))
    } catch {
      continue
    }
    for (const field of DEPENDENCY_FIELDS) {
      if (parsed[field]?.["@eleva/infra-migration"]) {
        problems.push(
          `${path.relative(root, manifest)} lists @eleva/infra-migration in ${field}`
        )
      }
    }
  }
  return { problems, scanned }
}

async function main() {
  const { problems, scanned } = await findMigrationImportProblems()
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    console.error(
      `Migration import check failed (${problems.length}): apps and packages never depend on infra/migration.`
    )
    process.exit(1)
  }
  console.log(`Migration import check passed (${scanned} files scanned).`)
}

// Run when called as a script, however the path was written.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  await main()
}
