import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  findRouteGuardProblems,
  validatesRequest,
} from "./check-route-guards.mjs"

const SCRIPT = path.join(import.meta.dirname, "check-route-guards.mjs")
const API = "apps/api/src/app"

const made = []
after(() => {
  for (const root of made) rmSync(root, { recursive: true, force: true })
})

/** A throwaway repository holding these files (path -> source). */
function repo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "route-guards-"))
  made.push(root)
  for (const [relative, source] of Object.entries(files)) {
    const file = path.join(root, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, source)
  }
  return root
}

const policy = (auth, rateLimit = true, botId = false) =>
  `export const ROUTE_POLICY = { auth: "${auth}", rateLimit: ${rateLimit}, botId: ${botId} } as const satisfies RoutePolicy\n`
const LIMIT = `  const limited = await applyRateLimit(key, RATE_LIMITS.authenticated)\n`
const AUTH = `  const session = await requireApiAuth(request)\n`
const handler = (method, body) =>
  `export async function ${method}(request: Request) {\n${body}  return secureJson({ ok: true })\n}\n`

/** A session route that is guarded and limited; `rest` decides validation. */
const sessionPost = (rest) =>
  policy("session") + handler("POST", AUTH + LIMIT + rest)

/** The problems of one route file, as the lines the script would print. */
async function problemsOf(source, extra = {}, name = "thing") {
  const root = repo({ [`${API}/${name}/route.ts`]: source, ...extra })
  const found = await findRouteGuardProblems(root)
  return [...found.missingPolicy, ...found.unenforced]
}

test("a guarded route of each auth mode passes", async () => {
  const routes = {
    [`${API}/pub/route.ts`]:
      policy("public") +
      handler("POST", LIMIT + `  BodySchema.safeParse(await request.json())\n`),
    [`${API}/signed-in/route.ts`]: sessionPost(
      `  const body = BodyRequestSchema.safeParse(await request.json())\n`
    ),
    [`${API}/hook/route.ts`]:
      policy("signature") +
      handler("POST", LIMIT + `  await handleStripeWebhook(request)\n`),
    [`${API}/job/route.ts`]:
      policy("internal", false) +
      handler("POST", `  await runInternalWorkflow(request, job)\n`),
    [`${API}/read/route.ts`]:
      policy("public", false) + `export function GET() {}\n`,
  }
  const found = await findRouteGuardProblems(repo(routes))
  assert.deepEqual(found, {
    routes: 5,
    missingPolicy: [],
    unenforced: [],
    authenticatedExpertsDir: false,
    frontendRoutes: [],
  })
})

test("a route without a readable, valid policy is named", async () => {
  const shapes = {
    missing: handler("GET", ""),
    spread: `const base = {}\nexport const ROUTE_POLICY = { ...base }\n`,
    "not-literal": `export const ROUTE_POLICY = { auth: mode(), rateLimit: true, botId: false }\n`,
    "unknown-auth": policy("anyone"),
    "no-rate-limit-field": `export const ROUTE_POLICY = { auth: "public", botId: false }\n`,
  }
  for (const [name, source] of Object.entries(shapes)) {
    assert.deepEqual(
      await problemsOf(source + handler("GET", ""), {}, name),
      [`${API}/${name}/route.ts`],
      name
    )
  }
})

test("export * and a route file written another way are refused", async () => {
  const star = await problemsOf(
    policy("public", false) + `export * from "./handlers"\n`
  )
  assert.match(star[0], /"export \*" hides which methods/)

  const root = repo({
    [`${API}/odd/route.tsx`]:
      policy("public", false) + `export function GET() {}\n`,
  })
  const { unenforced } = await findRouteGuardProblems(root)
  assert.match(
    unenforced[0],
    /odd\/route\.tsx: route handlers are named route\.ts/
  )
})

test("rateLimit: true needs a real applyRateLimit call", async () => {
  const open = policy("public") + `export function GET() {}\n`
  assert.match(
    (await problemsOf(open))[0],
    /rateLimit:true but no applyRateLimit\(\) call/
  )

  // In a comment or only imported: not a call.
  const commented =
    policy("public") +
    `import { applyRateLimit } from "@/lib/rate-limit"\n// applyRateLimit(key, limits)\nexport function GET() {}\n`
  assert.equal((await problemsOf(commented)).length, 1)

  // In a sibling handler the route delegates to: counts.
  const delegated = policy("public") + `export { GET } from "./handler"\n`
  assert.deepEqual(
    await problemsOf(delegated, {
      [`${API}/thing/handler.ts`]: handler("GET", LIMIT),
    }),
    []
  )
})

test("botId: true needs a checkBot call", async () => {
  const body = LIMIT + `  BodySchema.safeParse(await request.json())\n`
  const without = policy("public", true, true) + handler("POST", body)
  assert.match(
    (await problemsOf(without))[0],
    /botId:true but no checkBot\(\) call/
  )
  const withIt =
    policy("public", true, true) +
    handler("POST", `  await checkBot(request)\n` + body)
  assert.deepEqual(await problemsOf(withIt), [])
})

test("each auth mode is held to a call that enforces it", async () => {
  const get = (auth, body) => policy(auth, false) + handler("GET", body)
  for (const [auth, enforced] of [
    ["session", AUTH],
    ["signature", `  verifySignature(request)\n`],
    ["internal", `  authorizeInternalWorkflow(request)\n`],
  ]) {
    assert.deepEqual(await problemsOf(get(auth, enforced)), [], auth)
    assert.match(
      (await problemsOf(get(auth, "")))[0],
      new RegExp(`auth:"${auth}" but no call that enforces it`),
      auth
    )
  }
  // Importing a shared helper from lib/ is not a check, even when that
  // module is the one that defines the guard.
  const imported =
    policy("session", false) +
    `import { teamErrorResponse } from "@/lib/teams-http"\n` +
    handler("GET", `  teamErrorResponse()\n`)
  assert.equal(
    (
      await problemsOf(imported, {
        "apps/api/src/lib/teams-http.ts": `export async function requireTeamCaller(r) { return requireApiAuth(r) }\nexport function teamErrorResponse() {}\n`,
      })
    ).length,
    1
  )
})

const VALIDATES_NOTHING = /validates nothing the request sent/

test("what does not validate a request", async () => {
  const notValidation = {
    "another library's parse": `  const jar = cookie.parse(request.headers.get("cookie") ?? "")\n`,
    "JSON.parse": `  const body = JSON.parse(await request.text())\n`,
    "an environment schema": `  const env = EnvSchema.parse(process.env)\n`,
    "an inline parse of the environment": `  const max = z.coerce.number().parse(process.env.MAX)\n`,
    "an output schema inside the response": `  return secureJson(TeamSummarySchema.parse(row))\n`,
    "an output schema inside Response.json": `  return Response.json(ResultSchema.parse(row))\n`,
    "an audit wrapper alone": `  await withAudit({ orgId }, async (tx, ctx) => { await ctx.emit(event) })\n`,
    "a helper with a promising name": `  const body = await parseJson(request)\n`,
    "the word in a comment": `  // BodySchema.safeParse(body) would go here\n`,
    "the word in a string": `  const hint = "call BodySchema.safeParse(body)"\n`,
  }
  for (const [name, body] of Object.entries(notValidation)) {
    const lines = await problemsOf(sessionPost(body))
    assert.equal(lines.length, 1, name)
    assert.match(lines[0], VALIDATES_NOTHING, name)
  }

  // A schema parse that exists only in a shared lib/ module the route
  // imports: on the old rule this let every route importing it pass.
  const viaLib = sessionPost(`  return teamSummary(row)\n`).replace(
    "export async function",
    `import { teamSummary } from "@/lib/teams-http"\nexport async function`
  )
  const lines = await problemsOf(viaLib, {
    "apps/api/src/lib/teams-http.ts": `export function teamSummary(row) { return TeamSummarySchema.parse(row) }\nexport function check(body) { return BodyRequestSchema.safeParse(body) }\n`,
  })
  assert.match(lines[0], VALIDATES_NOTHING)
})

test("what validates a request", async () => {
  const validation = {
    "a request schema": `  const body = CreateThingRequestSchema.safeParse(await request.json())\n`,
    "an id schema on a path parameter": `  const id = IdSchema.parse(params.id)\n`,
    "an inline zod chain": `  const id = z.string().uuid().safeParse(params.id)\n`,
    "an async parse": `  const body = await BodySchema.safeParseAsync(await request.json())\n`,
    "the no-body validator": `  const unexpected = await rejectUnexpectedBody(request, headers)\n`,
    "a request parse beside an output parse": `  const body = BodySchema.parse(await request.json())\n  return secureJson(ResultSchema.parse(body))\n`,
  }
  for (const [name, body] of Object.entries(validation)) {
    assert.deepEqual(await problemsOf(sessionPost(body)), [], name)
  }
  // In a sibling handler the route delegates to.
  const delegated = policy("session") + `export { POST } from "./handle-post"\n`
  assert.deepEqual(
    await problemsOf(delegated, {
      [`${API}/thing/handle-post.ts`]: handler(
        "POST",
        AUTH + LIMIT + `  BodySchema.safeParse(await request.json())\n`
      ),
    }),
    []
  )
})

test("validatesRequest reads calls, by receiver and by position", () => {
  assert.equal(validatesRequest(`BodySchema.safeParse(body)`), true)
  assert.equal(
    validatesRequest(`z.object({ a: z.string() }).parse(body)`),
    true
  )
  assert.equal(validatesRequest(`schema.parse(body)`), false)
  assert.equal(validatesRequest(`URL.parse(href)`), false)
  assert.equal(validatesRequest(`secureJson(OutSchema.parse(row))`), false)
  // A parse inside a callback that happens to sit in a response is input
  // validation again once it has its own function.
  assert.equal(
    validatesRequest(`secureJson(rows.map((row) => RowSchema.parse(row)))`),
    true
  )
})

test("what the rule cannot see, written down so nobody takes it for more", async () => {
  // It reads the file, not each handler: PATCH's parse covers DELETE, which
  // uses its path id as sent.
  const mixed =
    policy("session") +
    handler(
      "PATCH",
      AUTH + LIMIT + `  BodySchema.safeParse(await request.json())\n`
    ) +
    handler("DELETE", AUTH + LIMIT + `  await remove((await params).id)\n`)
  assert.deepEqual(await problemsOf(mixed), [])
  // A call written inside a string still counts for rate limit: call sites
  // are found in text with comments cut out, not in the syntax tree.
  const inAString =
    policy("public") +
    `const hint = "applyRateLimit(key)"\nexport function GET() {}\n`
  assert.deepEqual(await problemsOf(inAString), [])
  // A type-only re-export hands nothing over.
  const typeOnly =
    policy("public") +
    `export type { Limit } from "./handler"\nexport function GET() {}\n`
  assert.equal(
    (
      await problemsOf(typeOnly, {
        [`${API}/thing/handler.ts`]: handler("GET", LIMIT),
      })
    ).length,
    1
  )
})

test("only mutating public and session routes are asked for validation", async () => {
  assert.deepEqual(
    await problemsOf(policy("session") + handler("GET", AUTH + LIMIT)),
    []
  )
  assert.deepEqual(
    await problemsOf(
      policy("signature") +
        handler("POST", LIMIT + `  await handleDailyWebhook(request)\n`)
    ),
    []
  )
  // Better Auth owns its own validation, at that exact path and no other.
  const vendor = policy("public") + handler("POST", LIMIT)
  assert.deepEqual(await problemsOf(vendor, {}, "auth/[...all]"), [])
  assert.match(
    (await problemsOf(vendor, {}, "auth/other"))[0],
    VALIDATES_NOTHING
  )
})

test("route handlers belong in apps/api, with three listed exceptions", async () => {
  const route = `export function GET() {}\n`
  const root = repo({
    "apps/web/src/app/api/thing/route.ts": route,
    "apps/account/src/app/(auth)/dashboard/route.ts": route,
    "apps/poc/src/app/anything/route.ts": route,
    [`${API}/experts/route.ts`]: policy("public", false) + route,
  })
  const found = await findRouteGuardProblems(root)
  assert.deepEqual(found.frontendRoutes, [
    "apps/web/src/app/api/thing/route.ts",
  ])
  assert.equal(found.authenticatedExpertsDir, true)
})

test("the script passes on this repository and names what fails elsewhere", () => {
  const out = execFileSync("node", [SCRIPT], { encoding: "utf8" })
  assert.match(out, /Route guard check passed \(\d+ routes\)\./)

  const bad = repo({
    [`${API}/thing/route.ts`]: sessionPost(
      `  await withAudit(options, write)\n`
    ),
  })
  const run = spawnSync("node", [SCRIPT, bad], { encoding: "utf8" })
  assert.equal(run.status, 1)
  assert.match(
    run.stderr,
    /thing\/route\.ts: mutating session route that validates nothing/
  )
  assert.match(run.stderr, /rejectUnexpectedBody\(\)/)

  // A path with no routes under it has not passed.
  const empty = spawnSync("node", [SCRIPT, repo({})], { encoding: "utf8" })
  assert.equal(empty.status, 1)
  assert.match(empty.stderr, /No route handler found/)

  const noPolicy = repo({ [`${API}/thing/route.ts`]: handler("GET", "") })
  const second = spawnSync("node", [SCRIPT, noPolicy], { encoding: "utf8" })
  assert.equal(second.status, 1)
  assert.match(second.stderr, /must export ROUTE_POLICY[\s\S]*thing\/route\.ts/)
})
