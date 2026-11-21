#!/usr/bin/env node
/**
 * CI guard for apps/api route handlers.
 *
 * 1. Every route handler is a route.ts that exports a literal ROUTE_POLICY
 *    (auth, rateLimit, botId).
 * 2. The policy is enforced, not just documented: `auth` other than
 *    "public" requires a reachable call that enforces it, `rateLimit: true` a
 *    reachable `applyRateLimit(` call, `botId: true` a reachable `checkBot(`,
 *    and a mutating public/session route a reachable Zod parse or audit
 *    wrapper. "Reachable" = the route file or a local module it imports
 *    (two import hops, `@/` and relative specifiers).
 */
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"
import {
  exportedMethods,
  extractPolicy,
  walkRoutes,
} from "./lib/route-policy.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const APP_DIR = path.join(ROOT, "apps/api/src/app")
const SRC_DIR = path.join(ROOT, "apps/api/src")
const AUTH_MODES = new Set(["public", "session", "signature", "internal"])

function isValidPolicy(policy) {
  return (
    policy !== null &&
    AUTH_MODES.has(policy.auth) &&
    typeof policy.rateLimit === "boolean" &&
    typeof policy.botId === "boolean"
  )
}

// What enforces each declared auth model. `public` needs none. A webhook
// route may hand the raw request to its domain handler (`handle…Webhook`),
// which verifies the signature inside the package: this check sees the
// hand-over, not the verification itself.
const AUTH_CALLS = {
  session:
    /\b(?:require[A-Z]\w*|resolveApiAuth|getSession|verifyApiKey)\(|\bauth\.api\./,
  signature:
    /\b\w*(?:[Vv]erify|constructEvent|[Ss]ignature)\w*\(|\bhandle\w*Webhook\(/,
  internal: /\b\w*(?:[Ii]nternal|[Ww]orkflow|[Cc]ron|[Ss]ecret)\w*\(/,
}

// Routes whose request validation is owned by a vendor handler.
const VALIDATION_EXEMPT = new Set(["apps/api/src/app/auth/[...all]/route.ts"])
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
// Receivers whose `.parse(` reads something other than a request body.
const NOT_A_SCHEMA = new Set([
  "JSON",
  "Date",
  "Number",
  "URL",
  "url",
  "path",
  "qs",
  "querystring",
])
const AUDIT_OR_HELPER_CALL =
  /\bwithAudit\(|\bwithPlatformAudit\(|\bparseJson\(|\breadJson\(/
// `Schema.parse(` / `.safeParse(` count only for request-side schemas: JSON
// and *Response* schemas are output validation, not input validation.
const SCHEMA_PARSE_CALL = /\b([A-Za-z_$][\w$]*)\.(?:safeParse|parse)\(/g

function validatesRequest(source) {
  if (AUDIT_OR_HELPER_CALL.test(source)) return true
  for (const match of source.matchAll(SCHEMA_PARSE_CALL)) {
    const receiver = match[1]
    if (!NOT_A_SCHEMA.has(receiver) && !/Response/.test(receiver)) return true
  }
  return false
}

const sourceCache = new Map()
async function sourceOf(file) {
  if (!sourceCache.has(file))
    sourceCache.set(file, await readFile(file, "utf8"))
  return sourceCache.get(file)
}

// Comments never count as an enforcement call site.
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm
async function codeOf(file) {
  return (await sourceOf(file)).replace(COMMENTS, "")
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

// Guard definitions and shared infrastructure modules never count as an
// enforcement call site (they parse unrelated data or only define the guard),
// otherwise every route importing them would pass vacuously.
const GUARD_DEFINITIONS = [
  "lib/rate-limit.ts",
  "lib/bot-protection.ts",
  "lib/auth.ts",
  "lib/cors.ts",
  "lib/security-headers.ts",
  "lib/route-policy.ts",
  "lib/idempotency.ts",
  "lib/openapi.ts",
]
async function reachesCall(file, matches) {
  for (const candidate of await reachable(file)) {
    if (GUARD_DEFINITIONS.some((def) => candidate.endsWith(def))) continue
    if (matches(await codeOf(candidate))) return true
  }
  return false
}

const routes = await walkRoutes(APP_DIR)
const missing = []
const unenforced = []

for (const file of routes) {
  const content = await codeOf(file)
  const relative = path.relative(ROOT, file)
  if (path.basename(file) !== "route.ts") {
    unenforced.push(
      `${relative}: route handlers are named route.ts (this file is served by Next.js but written another way)`
    )
    continue
  }
  const policy = extractPolicy(content)
  if (!isValidPolicy(policy)) {
    missing.push(relative)
    continue
  }
  // Read from the syntax tree, so every way of exporting a method counts.
  const { methods, opaque } = exportedMethods(content)
  if (opaque) {
    unenforced.push(
      `${relative}: "export *" hides which methods the route exports. Export each method by name.`
    )
    continue
  }
  const mutates = methods.some((method) => MUTATING_METHODS.has(method))
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
  // The declared auth model is held to a call that enforces it.
  const enforcesAuth = AUTH_CALLS[policy.auth]
  if (
    enforcesAuth &&
    !(await reachesCall(file, (src) => enforcesAuth.test(src)))
  ) {
    unenforced.push(
      `${relative}: auth:"${policy.auth}" but no call that enforces it`
    )
  }
  if (
    mutates &&
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
  // Records the org onboarding found, then redirects to /dashboard.
  "apps/account/src/app/onboarding/continue/route.ts",
])
const appsDir = path.join(ROOT, "apps")
const frontendRoutes = []
for (const entry of await readdir(appsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "api" || entry.name === "poc") {
    continue
  }
  const appDir = path.join(appsDir, entry.name, "src/app")
  if (!existsSync(appDir)) continue
  for (const file of await walkRoutes(appDir)) {
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
