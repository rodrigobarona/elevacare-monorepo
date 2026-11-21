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
 * The check fails closed: a route whose policy or exports cannot be read is
 * a failure, never a skip. The list is checked both ways, so an entry for a
 * route that is no longer a public mutation without BotID fails too.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  exportedMethods,
  extractPolicy,
  walkRoutes,
} from "./lib/route-policy.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const APP_DIR = path.join(ROOT, "apps/api/src/app")
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/** Public mutations that cannot run BotID, each with its reason. */
const EXEMPT = {
  "/auth/[...all]":
    "Better Auth owns sign-in, refresh and callback throttling; BotID would break session refresh and machine clients.",
  "/auth/e2e/verify-email":
    "E2E-only: answers 404 unless the bypass token is mounted and refuses to run in production; Playwright cannot attest.",
}

function routePath(file) {
  const relative = path.relative(APP_DIR, path.dirname(file))
  return `/${relative.split(path.sep).join("/")}`
}

/** Checks route sources given as `{ route, source }`. Exported for the test. */
export function findBotIdProblems(routes, exempt = EXEMPT) {
  const problems = []
  const unprotected = new Set()
  let publicMutations = 0

  for (const { route, source } of routes) {
    const policy = extractPolicy(source)
    if (policy === null || typeof policy.auth !== "string") {
      problems.push(
        `${route}: ROUTE_POLICY cannot be read (it must be an exported object literal with a literal auth).`
      )
      continue
    }
    const { methods, opaque } = exportedMethods(source)
    if (opaque) {
      problems.push(
        `${route}: "export *" hides which methods the route exports. Export each method by name.`
      )
      continue
    }
    if (policy.auth !== "public") continue
    const mutations = methods.filter((method) => MUTATING_METHODS.has(method))
    if (mutations.length === 0) continue
    publicMutations += 1
    if (policy.botId === true) continue
    unprotected.add(route)
    if (!Object.hasOwn(exempt, route)) {
      problems.push(
        `${route} (${mutations.join(", ")}) is a public mutation without BotID. Set botId: true and call checkBot(), or add it to EXEMPT in scripts/check-botid-coverage.mjs with the reason.`
      )
    }
  }

  for (const route of Object.keys(exempt)) {
    if (!unprotected.has(route)) {
      problems.push(
        `${route} is listed as exempt but is no longer a public mutation without BotID. Remove it from EXEMPT.`
      )
    }
  }
  return { problems, publicMutations }
}

async function main() {
  const routes = []
  for (const file of await walkRoutes(APP_DIR)) {
    routes.push({
      route: routePath(file),
      source: await readFile(file, "utf8"),
    })
  }
  const { problems, publicMutations } = findBotIdProblems(routes)
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    console.error(`BotID coverage check failed (${problems.length}).`)
    process.exit(1)
  }
  console.log(
    `BotID coverage check passed (${publicMutations} public mutations, ${Object.keys(EXEMPT).length} exempt with a reason).`
  )
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
