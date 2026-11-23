#!/usr/bin/env node
/**
 * CI guard for apps/api route handlers.
 *
 * 1. Every route handler is a route.ts that exports a literal ROUTE_POLICY
 *    (auth, rateLimit, botId).
 * 2. The policy is enforced, not just documented: `auth` other than
 *    "public" requires a reachable call that enforces it, `rateLimit: true` a
 *    reachable `applyRateLimit(` call, `botId: true` a reachable `checkBot(`,
 *    and a mutating public/session route a call that validates what the
 *    request sent (`REQUEST_VALIDATION` below).
 *
 * "Reachable" for rate limit and BotID = the route file or a local module
 * it imports (two import hops, `@/` and relative specifiers). For auth and
 * for validation = the route file or a handler it delegates to by a
 * relative path: a shared helper imported from `@/lib` never counts.
 *
 * The logic is exported (`findRouteGuardProblems`, `validatesRequest`) and
 * tested in `check-route-guards.test.mjs`.
 */
import { existsSync, realpathSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"
import {
  exportedMethods,
  extractPolicy,
  walkRoutes,
} from "./lib/route-policy.mjs"

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
  // By name: a job that merely has "workflow" in its name is not a check.
  internal:
    /\b(?:authorizeInternalWorkflow|runInternalWorkflow|requireCronSecret|isAuthorizedWorkflowCall)\(/,
}

// Routes whose request validation is owned by a vendor handler.
const VALIDATION_EXEMPT = new Set(["apps/api/src/app/auth/[...all]/route.ts"])
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * What counts as validating a request. A list of what counts, not of what
 * does not: a new library's `.parse(` must never pass by not being listed.
 *
 * What this cannot see, each pinned by a test so nobody takes it for more:
 * it looks at the file, not at each handler, so one method's parse covers
 * another method of the same route; it does not know whether the value came
 * from the request (only that it is not `process.env`), nor whether every
 * path id is parsed, nor whether the result is used.
 */
export const REQUEST_VALIDATION = {
  /**
   * Functions that are themselves a validation of the request.
   * `rejectUnexpectedBody`: "this action takes no body" (lib/empty-body.ts).
   */
  namedValidators: new Set(["rejectUnexpectedBody"]),
  /** The Zod calls that check a value against a schema. */
  parseMethods: new Set(["parse", "safeParse", "parseAsync", "safeParseAsync"]),
  /**
   * A receiver that is a schema: an identifier ending in "Schema"
   * (`BodySchema`, `IdSchema`), or an inline chain that starts at `z`
   * (`z.string().uuid()`). `JSON`, `cookie`, `url` and the like are neither.
   */
  schemaName: /Schema$/,
  inlineRoot: "z",
  /**
   * A parse inside the arguments of one of these builds a response: that is
   * checking what Eleva sends, not what the caller sent.
   */
  responseBuilders: new Set(["secureJson", "json"]),
  /** A parse of the environment is configuration, not a request. */
  notARequest: "process",
}

function calleeName(call) {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return ""
}

/** True when `node` sits in the arguments of a response builder. */
function buildsAResponse(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) return false
    if (
      ts.isCallExpression(parent) &&
      REQUEST_VALIDATION.responseBuilders.has(calleeName(parent))
    ) {
      return true
    }
  }
  return false
}

/** The identifier an expression chain starts at: `z` in `z.string().uuid()`. */
function chainRoot(expression) {
  let current = expression
  while (
    ts.isCallExpression(current) ||
    ts.isPropertyAccessExpression(current)
  ) {
    current = current.expression
  }
  return ts.isIdentifier(current) ? current.text : ""
}

/**
 * True when this source validates what a request sent, by the rules of
 * `REQUEST_VALIDATION`. Read from the syntax tree, so a comment or a string
 * that mentions `safeParse` is not a call.
 */
export function validatesRequest(source, fileName = "route.ts") {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  let found = false
  const visit = (node) => {
    if (found) return
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (
        ts.isIdentifier(callee) &&
        REQUEST_VALIDATION.namedValidators.has(callee.text)
      ) {
        found = true
        return
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        REQUEST_VALIDATION.parseMethods.has(callee.name.text)
      ) {
        const receiver = callee.expression
        const isSchema = ts.isIdentifier(receiver)
          ? REQUEST_VALIDATION.schemaName.test(receiver.text)
          : chainRoot(receiver) === REQUEST_VALIDATION.inlineRoot
        const [parsed] = node.arguments
        const readsEnvironment =
          parsed !== undefined &&
          chainRoot(parsed) === REQUEST_VALIDATION.notARequest
        if (isSchema && !readsEnvironment && !buildsAResponse(node)) {
          found = true
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

// Comments never count as an enforcement call site.
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm

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

// HTTP endpoints live in apps/api. Only GET redirect handlers that must set
// cookies (a Server Component cannot) may live in a frontend app.
const FRONTEND_ROUTE_EXCEPTIONS = new Set([
  "apps/account/src/app/(auth)/dashboard/route.ts",
  "apps/account/src/app/account/(shell)/billing/return/route.ts",
  // Records the org onboarding found, then redirects to /dashboard.
  "apps/account/src/app/onboarding/continue/route.ts",
])

/**
 * Every problem in the repository at `root`, by kind:
 *
 * - `missingPolicy`: route files with no valid `ROUTE_POLICY`;
 * - `unenforced`: a line for each policy field no call enforces, and each
 *   mutating route that validates nothing;
 * - `authenticatedExpertsDir`: `apps/api/src/app/experts/` exists;
 * - `frontendRoutes`: route handlers in an app other than `apps/api`.
 */
export async function findRouteGuardProblems(root) {
  const appDir = path.join(root, "apps/api/src/app")
  const srcDir = path.join(root, "apps/api/src")

  const sourceCache = new Map()
  async function sourceOf(file) {
    if (!sourceCache.has(file))
      sourceCache.set(file, await readFile(file, "utf8"))
    return sourceCache.get(file)
  }
  async function codeOf(file) {
    return (await sourceOf(file)).replace(COMMENTS, "")
  }

  function resolveLocal(from, specifier) {
    let base
    if (specifier.startsWith("@/")) base = path.join(srcDir, specifier.slice(2))
    else if (specifier.startsWith(".")) {
      base = path.resolve(path.dirname(from), specifier)
    } else return null
    return (
      [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
        (candidate) => existsSync(candidate)
      ) ?? null
    )
  }

  async function localImports(file, relativeOnly) {
    const sf = ts.createSourceFile(
      file,
      await sourceOf(file),
      ts.ScriptTarget.Latest,
      true
    )
    const resolved = []
    sf.forEachChild((node) => {
      // `import … from` and `export { POST } from`: both hand work to
      // another module. A type-only one hands over nothing.
      const typeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly
        : ts.isExportDeclaration(node) && node.isTypeOnly
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        !typeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text
        if (relativeOnly && !specifier.startsWith(".")) return
        const target = resolveLocal(file, specifier)
        if (target) resolved.push(target)
      }
    })
    return resolved
  }

  async function reachable(file, relativeOnly) {
    const seen = new Set([file])
    let frontier = [file]
    for (let hop = 0; hop < 2; hop++) {
      const next = []
      for (const current of frontier) {
        for (const dep of await localImports(current, relativeOnly)) {
          if (!seen.has(dep)) {
            seen.add(dep)
            next.push(dep)
          }
        }
      }
      frontier = next
    }
    return [...seen].filter(
      (candidate) => !GUARD_DEFINITIONS.some((def) => candidate.endsWith(def))
    )
  }

  /** A call matching `pattern`, in text with comments cut out. */
  async function reachesCall(file, pattern, relativeOnly = false) {
    for (const candidate of await reachable(file, relativeOnly)) {
      if (pattern.test(await codeOf(candidate))) return true
    }
    return false
  }

  /** Validation in the route file or a sibling handler, by the syntax tree. */
  async function reachesValidation(file) {
    for (const candidate of await reachable(file, true)) {
      if (validatesRequest(await sourceOf(candidate), candidate)) return true
    }
    return false
  }

  const routes = existsSync(appDir) ? await walkRoutes(appDir) : []
  const missingPolicy = []
  const unenforced = []

  for (const file of routes) {
    const relative = path.relative(root, file)
    if (path.basename(file) !== "route.ts") {
      unenforced.push(
        `${relative}: route handlers are named route.ts (this file is served by Next.js but written another way)`
      )
      continue
    }
    // The syntax tree is read from the file as written. Text with comments
    // cut out by a pattern is only for finding call sites: a "/*" inside a
    // string (an "image/*" accept list) would cut real code out of it.
    const raw = await sourceOf(file)
    const policy = extractPolicy(raw)
    if (!isValidPolicy(policy)) {
      missingPolicy.push(relative)
      continue
    }
    // Read from the syntax tree, so every way of exporting a method counts.
    const { methods, opaque } = exportedMethods(raw)
    if (opaque) {
      unenforced.push(
        `${relative}: "export *" hides which methods the route exports. Export each method by name.`
      )
      continue
    }
    const mutates = methods.some((method) => MUTATING_METHODS.has(method))
    if (policy.rateLimit && !(await reachesCall(file, /\bapplyRateLimit\(/))) {
      unenforced.push(
        `${relative}: rateLimit:true but no applyRateLimit() call`
      )
    }
    if (policy.botId && !(await reachesCall(file, /\bcheckBot\(/))) {
      unenforced.push(`${relative}: botId:true but no checkBot() call`)
    }
    // The declared auth model is held to a call that enforces it, in the
    // route file or a sibling handler it delegates to. A shared helper under
    // lib/ never counts: importing `teamErrorResponse` from a module that
    // also defines `requireTeamCaller` is not a check.
    const enforcesAuth = AUTH_CALLS[policy.auth]
    if (enforcesAuth && !(await reachesCall(file, enforcesAuth, true))) {
      unenforced.push(
        `${relative}: auth:"${policy.auth}" but no call that enforces it`
      )
    }
    if (
      mutates &&
      (policy.auth === "public" || policy.auth === "session") &&
      !VALIDATION_EXEMPT.has(relative) &&
      !(await reachesValidation(file))
    ) {
      unenforced.push(
        `${relative}: mutating ${policy.auth} route that validates nothing the request sent. Parse the body with its request schema (XRequestSchema.safeParse), parse each path id (z.string().uuid()), or call rejectUnexpectedBody() when the action takes no body. An audit wrapper, an output schema or a parse in a shared lib/ module does not count.`
      )
    }
  }

  // Authenticated expert resources use singular `/expert/*`. Plural
  // `/experts/*` is reserved for public reads under `public/experts` only
  // (Phase 04B).
  const authenticatedExpertsDir = existsSync(path.join(appDir, "experts"))

  const frontendRoutes = []
  const appsDir = path.join(root, "apps")
  const apps = existsSync(appsDir)
    ? await readdir(appsDir, { withFileTypes: true })
    : []
  for (const entry of apps) {
    if (!entry.isDirectory() || entry.name === "api" || entry.name === "poc") {
      continue
    }
    const frontendAppDir = path.join(appsDir, entry.name, "src/app")
    if (!existsSync(frontendAppDir)) continue
    for (const file of await walkRoutes(frontendAppDir)) {
      const relative = path.relative(root, file)
      if (!FRONTEND_ROUTE_EXCEPTIONS.has(relative))
        frontendRoutes.push(relative)
    }
  }

  return {
    routes: routes.length,
    missingPolicy,
    unenforced,
    authenticatedExpertsDir,
    frontendRoutes,
  }
}

async function main() {
  const root = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(import.meta.dirname, "..")
  const found = await findRouteGuardProblems(root)

  // A guard that looked at nothing has not passed: a wrong path, or a moved
  // apps/api, must be loud.
  if (found.routes === 0) {
    console.error(
      `Route guard check failed. No route handler found under ${path.join(root, "apps/api/src/app")}.`
    )
    process.exit(1)
  }

  if (found.missingPolicy.length > 0) {
    console.error(
      "Route guard check failed. Each apps/api route.ts must export ROUTE_POLICY with auth, rateLimit, and botId:\n"
    )
    for (const file of found.missingPolicy) console.error(`  ${file}`)
    process.exit(1)
  }

  if (found.unenforced.length > 0) {
    console.error("Route guard check failed. ROUTE_POLICY is not enforced:\n")
    for (const line of found.unenforced) console.error(`  ${line}`)
    process.exit(1)
  }

  if (found.authenticatedExpertsDir) {
    console.error(
      "Route guard check failed. Authenticated routes must live under apps/api/src/app/expert/ (singular).\n" +
        "Found apps/api/src/app/experts/ — move routes or keep only public reads under public/experts/.\n"
    )
    process.exit(1)
  }

  if (found.frontendRoutes.length > 0) {
    console.error(
      "Route guard check failed. Route Handlers belong in apps/api; move these or add a documented redirect-only exception:\n"
    )
    for (const file of found.frontendRoutes) console.error(`  ${file}`)
    process.exit(1)
  }

  console.log(`Route guard check passed (${found.routes} routes).`)
}

// Run when called as a script, however the path was written (a symlink, a
// space in the checkout path): a guard must never pass by not running.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  await main()
}
