#!/usr/bin/env node
/**
 * CI guard: Daily meeting-token JWTs must not appear in source as literals,
 * in ctx.emit payloads, or in join URLs. Complements Sentry/BetterStack
 * JWT redaction in @eleva/observability. Does not scan other audit writers.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const ROOTS = ["apps", "packages", "e2e", "scripts"]
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
  "scripts/check-no-phi-logs.mjs",
])
const FILE_RE = /\.(?:ts|tsx|js|mjs)$/

const JWT_RE = /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/
const MEETING_TOKEN_FIELD_RE =
  /\b(?:meetingToken|meeting_token)(?:\s*:|\s*[,}])/
const GENERIC_TOKEN_FIELD_RE = /\btoken(?:\s*:|\s*[,}])/
const JOIN_URL_TOKEN_RE =
  /sessions\/[^"'`\s]+\/join[^"'`\s]*[?&#](?:token|t|meetingToken|meeting_token)=/
const LOG_TOKEN_RE =
  /(?:console|logger|log)\.(?:log|debug|info|warn|error|trace|fatal|table)\([\s\S]{0,240}?\b(?:meetingToken|meeting_token|meeting token)\b/i

function objectEnd(content, brace) {
  let depth = 0
  let quote = null
  let escape = false
  for (let i = brace; i < content.length; i++) {
    const ch = content[i]
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "/" && content[i + 1] === "/") {
      const nl = content.indexOf("\n", i)
      if (nl === -1) break
      i = nl
      continue
    }
    if (ch === "/" && content[i + 1] === "*") {
      const endC = content.indexOf("*/", i + 2)
      if (endC === -1) break
      i = endC + 1
      continue
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function auditEmitPayloads(content) {
  const spans = []
  let unclosed = false
  let from = 0
  while (from < content.length) {
    const emitAt = content.indexOf(".emit(", from)
    if (emitAt === -1) break
    const open = content.indexOf("{", emitAt)
    if (open === -1 || open - emitAt > 20) {
      from = emitAt + 6
      continue
    }
    const emitEnd = objectEnd(content, open)
    if (emitEnd === -1) {
      unclosed = true
      break
    }
    const emitObj = content.slice(open, emitEnd + 1)
    const payAt = emitObj.indexOf("payload:")
    if (payAt !== -1) {
      const brace = emitObj.indexOf("{", payAt)
      if (brace !== -1 && brace - payAt <= 24) {
        const payEnd = objectEnd(emitObj, brace)
        if (payEnd === -1) {
          unclosed = true
          break
        }
        spans.push(emitObj.slice(brace, payEnd + 1))
      }
    }
    from = emitEnd + 1
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
  const payloads = auditEmitPayloads(content)
  if (payloads.unclosed) {
    violations.push(`${rel}: audit payload object did not close`)
  }
  if (
    payloads.spans.some(
      (span) =>
        MEETING_TOKEN_FIELD_RE.test(span) || GENERIC_TOKEN_FIELD_RE.test(span)
    )
  ) {
    violations.push(`${rel}: ctx.emit payload includes a token field`)
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
