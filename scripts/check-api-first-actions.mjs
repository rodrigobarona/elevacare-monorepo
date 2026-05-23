#!/usr/bin/env node
/**
 * CI guard: frontend Server Actions must not call @eleva/db write helpers.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const APPS_DIR = path.join(ROOT, "apps")

const BANNED = [
  "updateExpertProfile",
  "createEventType",
  "updateEventType",
  "deleteEventType",
  "disconnectIntegration",
  "replaceBusySources",
  "replaceDestinationCalendar",
  "ensureExpertProfileForOrgDetailed",
]

const IMPORT_RE = new RegExp(
  `import\\s*\\{[^}]*\\b(${BANNED.join("|")})\\b[^}]*\\}\\s*from\\s*["']@eleva/db["']`
)
const CALL_RE = new RegExp(`\\b(${BANNED.join("|")})\\s*\\(`)

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      files.push(...(await walk(full)))
    } else if (entry.name === "actions.ts") {
      files.push(full)
    }
  }
  return files
}

const actionFiles = await walk(APPS_DIR)
const violations = []

for (const file of actionFiles) {
  const content = await readFile(file, "utf8")
  if (IMPORT_RE.test(content)) {
    violations.push(
      `${path.relative(ROOT, file)}: imports banned @eleva/db write helper`
    )
    continue
  }
  if (CALL_RE.test(content)) {
    violations.push(
      `${path.relative(ROOT, file)}: calls banned @eleva/db write helper`
    )
  }
}

if (violations.length > 0) {
  console.error("API-first actions check failed:\n")
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(
  `API-first actions check passed (${actionFiles.length} action files scanned).`
)
