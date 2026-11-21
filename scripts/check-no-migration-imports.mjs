#!/usr/bin/env node
/**
 * CI guard (Phase 14): the MVP migration tools stay on their own.
 *
 * `infra/migration` is a temporary package that will hold the only code
 * allowed to read the MVP database and the previous identity provider's
 * vault. Nothing that ships (apps/**, packages/**) may import it, by its
 * package name or by path, so removing it after cutover (Phase 16.16)
 * cannot break the product.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const SCANNED = ["apps", "packages"]
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const SKIP = new Set(["node_modules", ".next", "dist", ".turbo", "coverage"])
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

const problems = []
let scanned = 0
for (const top of SCANNED) {
  for (const file of await walk(path.join(ROOT, top))) {
    scanned += 1
    const source = await readFile(file, "utf8")
    for (const match of source.matchAll(IMPORT)) {
      problems.push(`${path.relative(ROOT, file)} imports "${match[1]}"`)
    }
  }
}

// A dependency entry would let an import through later: refuse it too.
for (const top of SCANNED) {
  for (const entry of await readdir(path.join(ROOT, top), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue
    const manifest = path.join(ROOT, top, entry.name, "package.json")
    let parsed
    try {
      parsed = JSON.parse(await readFile(manifest, "utf8"))
    } catch {
      continue
    }
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
    ]) {
      if (parsed[field]?.["@eleva/infra-migration"]) {
        problems.push(
          `${path.relative(ROOT, manifest)} lists @eleva/infra-migration in ${field}`
        )
      }
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  console.error(
    `Migration import check failed (${problems.length}): apps and packages never depend on infra/migration.`
  )
  process.exit(1)
}
console.log(`Migration import check passed (${scanned} files scanned).`)
