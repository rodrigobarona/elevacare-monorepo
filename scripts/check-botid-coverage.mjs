#!/usr/bin/env node
/**
 * CI guard: every public mutation in apps/api is behind Vercel BotID.
 *
 * A route whose ROUTE_POLICY says `auth: "public"` and that exports POST,
 * PUT, PATCH or DELETE creates or changes something for a caller Eleva has
 * not identified. It must declare `botId: true` (which `check:route-guards`
 * then holds to a reachable `checkBot(` call), or be listed below with the
 * reason it cannot. Session, signature and internal routes are out of
 * scope: they authenticate the caller (AGENTS.md, "BotID on public routes").
 *
 * The list is checked both ways: a route that is listed but no longer a
 * public mutation without BotID fails too, so the list cannot rot.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const APP_DIR = path.join(ROOT, "apps/api/src/app")
const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"]

/** Public mutations that cannot run BotID, each with its reason. */
const EXEMPT = {
  "/auth/[...all]":
    "Better Auth owns sign-in, refresh and callback throttling; BotID would break session refresh and machine clients.",
  "/auth/e2e/verify-email":
    "E2E-only: answers 404 unless the bypass token is mounted and refuses to run in production; Playwright cannot attest.",
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name === "route.ts") files.push(full)
  }
  return files
}

function routePath(file) {
  const relative = path.relative(APP_DIR, path.dirname(file))
  return `/${relative.split(path.sep).join("/")}`
}

function exportedMutations(source) {
  return MUTATING_METHODS.filter((method) =>
    new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b|\\bas\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b`
    ).test(source)
  )
}

function policy(source) {
  const match = source.match(/ROUTE_POLICY\s*=\s*\{([\s\S]*?)\}\s*as const/)
  if (!match) return null
  return {
    auth: match[1].match(/auth:\s*"([a-z]+)"/)?.[1] ?? null,
    botId: /botId:\s*true/.test(match[1]),
  }
}

const problems = []
const unprotected = new Set()
let publicMutations = 0

for (const file of await walk(APP_DIR)) {
  const source = await readFile(file, "utf8")
  const declared = policy(source)
  if (!declared || declared.auth !== "public") continue
  const methods = exportedMutations(source)
  if (methods.length === 0) continue
  publicMutations += 1
  if (declared.botId) continue
  const route = routePath(file)
  unprotected.add(route)
  if (!Object.hasOwn(EXEMPT, route)) {
    problems.push(
      `${route} (${methods.join(", ")}) is a public mutation without BotID. Set botId: true and call checkBot(), or add it to EXEMPT in scripts/check-botid-coverage.mjs with the reason.`
    )
  }
}

for (const route of Object.keys(EXEMPT)) {
  if (!unprotected.has(route)) {
    problems.push(
      `${route} is listed as exempt but is no longer a public mutation without BotID. Remove it from EXEMPT.`
    )
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  console.error(`BotID coverage check failed (${problems.length}).`)
  process.exit(1)
}
console.log(
  `BotID coverage check passed (${publicMutations} public mutations, ${Object.keys(EXEMPT).length} exempt with a reason).`
)
