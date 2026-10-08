#!/usr/bin/env node
/**
 * CI guard: Daily meeting-token JWTs must not appear in source as literals,
 * in audit emit payloads, or in join URLs. Complements Sentry/BetterStack
 * JWT redaction in @eleva/observability.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const ROOTS = ["apps", "packages", "e2e"]
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "_context",
])
const SKIP_FILES = new Set([
  "packages/observability/src/redaction.ts",
  "packages/observability/src/redaction.test.ts",
  "packages/video/src/server/meeting-token.test.ts",
])
const FILE_RE = /\.(?:ts|tsx|js|mjs)$/

const JWT_RE = /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/
const MEETING_TOKEN_FIELD_RE = /\b(?:meetingToken|meeting_token)\s*:/
const GENERIC_TOKEN_FIELD_RE = /\btoken\s*:/
const ROOM_HINT_RE = /\b(?:roomName|roomUrl|dailyRoomName|dailyRoomUrl)\b/
const JOIN_URL_TOKEN_RE =
  /sessions\/[^"'`\s]+\/join[^"'`\s]*[?&#](?:token|t|meetingToken|meeting_token)=/
const LOG_TOKEN_RE =
  /(?:console|logger|log)\.(?:log|debug|info|warn|error|trace|fatal|table)\([^)]{0,240}\b(?:meetingToken|meeting_token|meeting token)\b/i

function auditPayloadObjects(content) {
  const spans = []
  let unclosed = false
  let from = 0
  while (from < content.length) {
    const at = content.indexOf("payload:", from)
    if (at === -1) break
    const brace = content.indexOf("{", at + 8)
    if (brace === -1 || brace - at > 24) {
      from = at + 8
      continue
    }
    let depth = 0
    let end = -1
    for (let i = brace; i < content.length; i++) {
      const ch = content[i]
      if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end === -1) {
      unclosed = true
      break
    }
    spans.push(content.slice(brace, end + 1))
    from = end + 1
  }
  return { spans, unclosed }
}

async function walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      return []
    }
    throw err
  }
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      files.push(...(await walk(full)))
      continue
    }
    if (FILE_RE.test(entry.name)) files.push(full)
  }
  return files
}

const files = []
for (const rel of ROOTS) {
  files.push(...(await walk(path.join(ROOT, rel))))
}

const violations = []

for (const file of files) {
  const rel = path.relative(ROOT, file)
  if (SKIP_FILES.has(rel)) continue
  const content = await readFile(file, "utf8")
  if (JWT_RE.test(content)) {
    violations.push(`${rel}: compact JWT literal`)
  }
  const payloads = auditPayloadObjects(content)
  if (payloads.unclosed) {
    violations.push(`${rel}: audit payload object did not close`)
  }
  if (
    payloads.spans.some(
      (span) =>
        MEETING_TOKEN_FIELD_RE.test(span) ||
        (GENERIC_TOKEN_FIELD_RE.test(span) && ROOM_HINT_RE.test(span))
    )
  ) {
    violations.push(`${rel}: audit payload includes a meeting token field`)
  }
  if (JOIN_URL_TOKEN_RE.test(content)) {
    violations.push(`${rel}: join URL carries a meeting token query param`)
  }
  if (LOG_TOKEN_RE.test(content)) {
    violations.push(`${rel}: log call mentions a meeting token`)
  }
}

if (violations.length > 0) {
  console.error("PHI / meeting-token log check failed:\n")
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(
  `PHI / meeting-token log check passed (${files.length} files scanned).`
)
