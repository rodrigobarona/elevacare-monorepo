#!/usr/bin/env node
/**
 * CI guard for apps/api route handlers.
 *
 * 1. Every route.ts exports a literal ROUTE_POLICY (auth, rateLimit, botId).
 * 2. The policy is enforced, not just documented: `rateLimit: true` requires a
 *    reachable `applyRateLimit(` call, `botId: true` a reachable `checkBot(`,
 *    and a mutating public/session route a reachable Zod parse or audit
 *    wrapper. "Reachable" = the route file or a local module it imports
 *    (two import hops, `@/` and relative specifiers).
 */
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

const ROOT = path.resolve(import.meta.dirname, "..")
const APP_DIR = path.join(ROOT, "apps/api/src/app")
const SRC_DIR = path.join(ROOT, "apps/api/src")
const AUTH_MODES = new Set(["public", "session", "signature", "internal"])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      files.push(...(await walk(full)))
    } else if (entry.name === "route.ts") {
      files.push(full)
    }
  }
  return files
}

function unwrap(node) {
  let current = node
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function readLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}

function extractPolicy(source) {
  const sf = ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  let policy = null

  function visit(node) {
    if (ts.isVariableStatement(node)) {
      const exported = node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
      if (exported) {
        for (const decl of node.declarationList.declarations) {
          if (
            !ts.isIdentifier(decl.name) ||
            decl.name.text !== "ROUTE_POLICY"
          ) {
            continue
          }
          if (!decl.initializer) continue
          const init = unwrap(decl.initializer)
          if (!ts.isObjectLiteralExpression(init)) continue
          const fields = {}
          for (const prop of init.properties) {
            if (ts.isSpreadAssignment(prop)) {
              policy = null
              return
            }
            if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
              continue
            }
            fields[prop.name.text] = readLiteral(unwrap(prop.initializer))
          }
          policy = fields
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)
  return policy
}

function isValidPolicy(policy) {
  return (
    policy !== null &&
    AUTH_MODES.has(policy.auth) &&
    typeof policy.rateLimit === "boolean" &&
    typeof policy.botId === "boolean"
  )
}

// Routes whose request validation is owned by a vendor handler.
const VALIDATION_EXEMPT = new Set(["apps/api/src/app/auth/[...all]/route.ts"])
const MUTATING_EXPORT =
  /export\s+(?:async\s+function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/
const AUDIT_OR_HELPER_CALL =
  /\bwithAudit\(|\bwithPlatformAudit\(|\bparseJson\(|\breadJson\(/
// `Schema.parse(` / `.safeParse(` count only for request-side schemas: JSON
// and *Response* schemas are output validation, not input validation.
const SCHEMA_PARSE_CALL = /\b([A-Za-z_$][\w$]*)\.(?:safeParse|parse)\(/g

function validatesRequest(source) {
  if (AUDIT_OR_HELPER_CALL.test(source)) return true
  for (const match of source.matchAll(SCHEMA_PARSE_CALL)) {
    const receiver = match[1]
    if (receiver !== "JSON" && !/Response/.test(receiver)) return true
  }
  return false
}

const sourceCache = new Map()
async function sourceOf(file) {
  if (!sourceCache.has(file))
    sourceCache.set(file, await readFile(file, "utf8"))
  return sourceCache.get(file)
}

function resolveLocal(from, specifier) {
  let base
  if (specifier.startsWith("@/")) base = path.join(SRC_DIR, specifier.slice(2))
  else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(from), specifier)
  } else return null
  return (
    [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
      (candidate) => existsSync(candidate)
    ) ?? null
  )
}

async function localImports(file) {
  const sf = ts.createSourceFile(
    file,
    await sourceOf(file),
    ts.ScriptTarget.Latest,
    true
  )
  const resolved = []
  sf.forEachChild((node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = resolveLocal(file, node.moduleSpecifier.text)
      if (target) resolved.push(target)
    }
  })
  return resolved
}

async function reachable(file, hops = 2) {
  const seen = new Set([file])
  let frontier = [file]
  for (let hop = 0; hop < hops; hop++) {
    const next = []
    for (const current of frontier) {
      for (const dep of await localImports(current)) {
        if (!seen.has(dep)) {
          seen.add(dep)
          next.push(dep)
        }
      }
    }
    frontier = next
  }
  return [...seen]
}

// The guard definitions themselves never count as an enforcement call site.
const GUARD_DEFINITIONS = ["lib/rate-limit.ts", "lib/bot-protection.ts"]
async function reachesCall(file, matches) {
  for (const candidate of await reachable(file)) {
    if (GUARD_DEFINITIONS.some((def) => candidate.endsWith(def))) continue
    if (matches(await sourceOf(candidate))) return true
  }
  return false
}

const routes = await walk(APP_DIR)
const missing = []
const unenforced = []

for (const file of routes) {
  const content = await sourceOf(file)
  const relative = path.relative(ROOT, file)
  const policy = extractPolicy(content)
  if (!isValidPolicy(policy)) {
    missing.push(relative)
    continue
  }
  if (
    policy.rateLimit &&
    !(await reachesCall(file, (src) => /\bapplyRateLimit\(/.test(src)))
  ) {
    unenforced.push(`${relative}: rateLimit:true but no applyRateLimit() call`)
  }
  if (
    policy.botId &&
    !(await reachesCall(file, (src) => /\bcheckBot\(/.test(src)))
  ) {
    unenforced.push(`${relative}: botId:true but no checkBot() call`)
  }
  if (
    MUTATING_EXPORT.test(content) &&
    (policy.auth === "public" || policy.auth === "session") &&
    !VALIDATION_EXEMPT.has(relative) &&
    !(await reachesCall(file, validatesRequest))
  ) {
    unenforced.push(
      `${relative}: mutating ${policy.auth} route without Zod parse or audit wrapper`
    )
  }
}

if (missing.length > 0) {
  console.error(
    "Route guard check failed. Each apps/api route.ts must export ROUTE_POLICY with auth, rateLimit, and botId:\n"
  )
  for (const file of missing) console.error(`  ${file}`)
  process.exit(1)
}

if (unenforced.length > 0) {
  console.error("Route guard check failed. ROUTE_POLICY is not enforced:\n")
  for (const line of unenforced) console.error(`  ${line}`)
  process.exit(1)
}

// Authenticated expert resources use singular `/expert/*`. Plural `/experts/*`
// is reserved for public reads under `public/experts` only (Phase 04B).
const authenticatedExpertsDir = path.join(APP_DIR, "experts")
if (existsSync(authenticatedExpertsDir)) {
  console.error(
    "Route guard check failed. Authenticated routes must live under apps/api/src/app/expert/ (singular).\n" +
      "Found apps/api/src/app/experts/ — move routes or keep only public reads under public/experts/.\n"
  )
  process.exit(1)
}

// HTTP endpoints live in apps/api. Only GET redirect handlers that must set
// cookies (a Server Component cannot) may live in a frontend app.
const FRONTEND_ROUTE_EXCEPTIONS = new Set([
  "apps/account/src/app/(auth)/dashboard/route.ts",
  "apps/account/src/app/account/(shell)/billing/return/route.ts",
])
const appsDir = path.join(ROOT, "apps")
const frontendRoutes = []
for (const entry of await readdir(appsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "api" || entry.name === "poc") {
    continue
  }
  const appDir = path.join(appsDir, entry.name, "src/app")
  if (!existsSync(appDir)) continue
  for (const file of await walk(appDir)) {
    const relative = path.relative(ROOT, file)
    if (!FRONTEND_ROUTE_EXCEPTIONS.has(relative)) frontendRoutes.push(relative)
  }
}
if (frontendRoutes.length > 0) {
  console.error(
    "Route guard check failed. Route Handlers belong in apps/api; move these or add a documented redirect-only exception:\n"
  )
  for (const file of frontendRoutes) console.error(`  ${file}`)
  process.exit(1)
}

console.log(`Route guard check passed (${routes.length} routes).`)
