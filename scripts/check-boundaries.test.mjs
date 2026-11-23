import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  boundariesConfig,
  modulesAsText,
} from "../packages/eslint-config/boundaries.js"
import {
  FRONTEND_DB_READS,
  frontendDbReadsConfig,
} from "../packages/eslint-config/frontend-db-reads.js"
import { nextJsConfig } from "../packages/eslint-config/next.js"
import {
  appConfigProblems,
  appsWithoutLint,
  boundaryFindings,
  canariesFor,
  createEslint,
  filesWithOtherRules,
  findBoundaryProblems,
  lintedWorkspaces,
  report,
  isSharedConfigText,
  sharedConfigsFor,
  sharedConfigText,
  sourceFilesOf,
} from "./check-boundaries.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const SCRIPT = path.join(import.meta.dirname, "check-boundaries.mjs")

const made = []
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})
function temporary() {
  const dir = mkdtempSync(path.join(tmpdir(), "boundaries-"))
  made.push(dir)
  return dir
}

/**
 * The boundary rules an app's own lint config reports for this source,
 * through the ESLint the check itself builds.
 */
async function refused(app, file, code, options) {
  const cwd = path.join(ROOT, app)
  const eslint = createEslint(ROOT, cwd, options)
  const [result] = await eslint.lintText(code, {
    filePath: path.join(cwd, file),
  })
  return result.messages.map((message) => ({
    line: message.line,
    rule: message.ruleId,
  }))
}

const DB_RULE = "@typescript-eslint/no-restricted-imports"

/** One line of source, and whether an app must refuse it. */
const line = (code, rule = null) => ({ code, rule })

async function expectLines(app, file, lines) {
  const found = await refused(
    app,
    file,
    lines.map((one) => one.code).join("\n") + "\n"
  )
  const expected = lines.flatMap((one, index) =>
    one.rule ? [{ line: index + 1, rule: one.rule }] : []
  )
  // One finding a line is enough: some lines break two rules.
  const seen = new Set()
  const first = found.filter((one) => {
    if (seen.has(one.line)) return false
    seen.add(one.line)
    return true
  })
  assert.deepEqual(first, expected, `${app}: ${JSON.stringify(found)}`)
}

test("run as a command, through a link too: it checks, and says what", () => {
  // A script that only runs when called by its own path would pass,
  // having checked nothing, when called through a link.
  const link = path.join(temporary(), "check.mjs")
  symlinkSync(SCRIPT, link)
  const run = (...names) =>
    spawnSync(process.execPath, [link, ...names], { encoding: "utf8" })

  const one = run("apps/academy", "packages/ui/")
  assert.equal(one.status, 0, one.stderr)
  assert.match(
    one.stdout,
    /^Boundary check passed \(\d+ files in 2 workspaces\)\.$/m
  )
  const none = run("apps/no-such-app")
  assert.equal(none.status, 1)
  assert.match(
    none.stderr,
    /Not a workspace with a lint config: apps\/no-such-app/
  )
})

test("every app is on the list of what is checked", () => {
  assert.deepEqual(appsWithoutLint(ROOT), [])
  const apps = lintedWorkspaces(ROOT).filter((name) => name.startsWith("apps/"))
  for (const app of ["apps/api", "apps/web", "apps/expert", "apps/admin"]) {
    assert.ok(apps.includes(app), `${app} is linted`)
  }
  assert.ok(!apps.includes("apps/poc"), "the playground is not linted")
  assert.ok(lintedWorkspaces(ROOT).length >= 40)
})

test("what is printed, and the exit code", () => {
  assert.deepEqual(report("/repo", { problems: [], files: 9, workspaces: 2 }), {
    code: 0,
    lines: ["Boundary check passed (9 files in 2 workspaces)."],
  })
  const failed = report("/repo", {
    problems: ["apps/web/src/a.ts:1: no stripe (no-restricted-imports)"],
    files: 9,
    workspaces: 2,
  })
  assert.equal(failed.code, 1)
  assert.equal(
    failed.lines.at(-1),
    "- apps/web/src/a.ts:1: no stripe (no-restricted-imports)"
  )
  // Nothing linted is not a pass, and why is said.
  const nothing = report("/repo", {
    problems: ["apps/web: could not be checked (boom)"],
    files: 0,
    workspaces: 1,
  })
  assert.equal(nothing.code, 1)
  assert.equal(nothing.lines.at(-1), "- apps/web: could not be checked (boom)")
  assert.equal(
    report("/repo", { problems: [], files: 0, workspaces: 0 }).code,
    1
  )
})

test("an app's lint config exports the shared configs, and nothing else", () => {
  const [web] = sharedConfigsFor("apps/web")
  const [api] = sharedConfigsFor("apps/api")
  assert.deepEqual(appConfigProblems("apps/web", web), [])
  assert.deepEqual(appConfigProblems("apps/api", api), [])
  assert.deepEqual(
    appConfigProblems("apps/email", sharedConfigsFor("apps/email")[1]),
    []
  )

  const named = (workspace, config) => {
    const problems = appConfigProblems(workspace, config)
    assert.equal(problems.length, 1)
    assert.match(problems[0], new RegExp(`^${workspace}: the lint config `))
  }
  // An entry more: a folder ignored, a rule off, a rule set again.
  named("apps/web", [...web, { ignores: ["src/legacy/**"] }])
  named("apps/web", [...web, { rules: { "no-restricted-imports": "off" } }])
  named("apps/web", [
    ...web,
    { files: ["**/actions.ts"], rules: { "no-restricted-imports": ["error"] } },
  ])
  // An entry fewer, or the same entries rewritten.
  named("apps/web", [...nextJsConfig, ...boundariesConfig])
  named("apps/web", [...nextJsConfig, ...frontendDbReadsConfig])
  named("apps/web", [
    ...nextJsConfig,
    ...boundariesConfig,
    { ...frontendDbReadsConfig[0] },
  ])
  // The API's config on a frontend, and the other way round.
  named("apps/web", api)
  named("apps/api", web)
  named("apps/web", undefined)
})

test("an app's lint config file is the shared configs, and no other code", () => {
  const web = sharedConfigText("apps/web")
  assert.ok(isSharedConfigText("apps/web", web))
  assert.ok(
    web.includes(
      "export default [...nextJsConfig, ...boundariesConfig, ...frontendDbReadsConfig]"
    )
  )

  // How the file is laid out is not code: quotes, semicolons, comments,
  // the export on several lines with a comma at its end, the imports in
  // another order, the base config in place of the Next.js one.
  const lines = web.trim().split("\n")
  const laidOut = [
    web.replaceAll('"', "'").replaceAll("\n", ";\n") + "// a note\n",
    `/** @type {import("eslint").Linter.Config} */\n${web}`,
    web.replace(/\]\n$/, "] // the shared configs only\n"),
    web.replace(
      /export default \[(.*)\]/,
      (_all, entries) =>
        `export default [\n  ${entries.split(", ").join(",\n  ")},\n]`
    ),
    [lines[2], lines[0], lines[1], ...lines.slice(3)].join("\n"),
    web
      .replace(
        '{ nextJsConfig } from "@eleva/eslint-config/next-js"',
        '{ config } from "@eleva/eslint-config/base"'
      )
      .replace("...nextJsConfig", "...config"),
  ]
  for (const source of laidOut) {
    assert.ok(isSharedConfigText("apps/web", source), source)
  }

  const other = [
    // Code that runs when the file is loaded, around the same export.
    `process.exit(0)\n${web}`,
    web.replace(
      "export default",
      'frontendDbReadsConfig[0].rules["no-restricted-syntax"] = "off"\nexport default'
    ),
    // An entry more, an entry fewer, another order.
    web.replace("...frontendDbReadsConfig]", "...frontendDbReadsConfig, {}]"),
    web.replace(", ...frontendDbReadsConfig", ""),
    web.replace(
      "...boundariesConfig, ...frontendDbReadsConfig",
      "...frontendDbReadsConfig, ...boundariesConfig"
    ),
    // The shared configs from somewhere else, or under another name.
    web.replace("/boundaries", "/boundaries-local"),
    web.replace("{ boundariesConfig }", "{ boundariesConfig as b }"),
    `${web}import { x } from "./local"\n`,
    "",
  ]
  for (const source of other) {
    assert.ok(!isSharedConfigText("apps/web", source), source)
  }

  // A frontend's file is not the API's, nor the other way round.
  const api = sharedConfigText("apps/api")
  assert.ok(isSharedConfigText("apps/api", api))
  assert.ok(!isSharedConfigText("apps/web", api))
  assert.ok(!isSharedConfigText("apps/api", web))

  // What a developer is told: the file as it should read.
  const [told] = appConfigProblems(
    "apps/web",
    undefined,
    `${web}\nconsole.log(1)`
  )
  assert.match(
    told,
    /^apps\/web: the lint config of an app is the shared configs/
  )
  for (const line of lines.filter(Boolean)) assert.ok(told.includes(line), line)
})

test("every app's own lint config is exactly that, by text and by what it exports", async () => {
  for (const app of lintedWorkspaces(ROOT)) {
    if (!app.startsWith("apps/")) continue
    const file = path.join(ROOT, app, "eslint.config.js")
    assert.deepEqual(
      appConfigProblems(app, undefined, readFileSync(file, "utf8")),
      [],
      app
    )
    assert.deepEqual(
      appConfigProblems(app, (await import(file)).default),
      [],
      app
    )
  }
})

/**
 * A repository of its own, with one app, that the check can run on: the
 * lint package is linked in, so the app's config is the real shared one.
 */
function scratchRepository(files) {
  const root = temporary()
  const app = path.join(root, "apps", "demo")
  mkdirSync(path.join(root, "packages"), { recursive: true })
  symlinkSync(
    path.join(ROOT, "packages", "eslint-config"),
    path.join(root, "packages", "eslint-config")
  )
  mkdirSync(path.join(app, "node_modules", "@eleva"), { recursive: true })
  symlinkSync(
    path.join(ROOT, "packages", "eslint-config"),
    path.join(app, "node_modules", "@eleva", "eslint-config")
  )
  const all = {
    "eslint.config.js": readFileSync(
      path.join(ROOT, "apps", "academy", "eslint.config.js"),
      "utf8"
    ),
    "src/app/page.ts": "export const page = 1\n",
    ...files,
  }
  for (const [file, source] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(app, file)), { recursive: true })
    writeFileSync(path.join(app, file), source)
  }
  return { root, app }
}

const checkScratch = async (files) => {
  const { root, app } = scratchRepository(files)
  const found = await findBoundaryProblems(root, { workspaces: ["apps/demo"] })
  return { ...found, root, app }
}

test("an app on its own: clean passes, and each way of going wrong is named", async () => {
  const clean = await checkScratch({})
  assert.deepEqual(clean.problems, [])
  assert.equal(clean.files, 2)

  // A boundary crossed in the code.
  const crossed = await checkScratch({
    "src/app/x/page.ts":
      'import { db } from "@eleva/db"\nexport const x = db\n',
  })
  assert.equal(crossed.problems.length, 1, crossed.problems.join("\n"))
  assert.match(crossed.problems[0], /^apps\/demo\/src\/app\/x\/page\.ts:1: /)

  // A file that lint skips: the shared config ignores `.turbo` anywhere.
  const skipped = await checkScratch({
    "src/lib/.turbo/hidden.ts":
      'import { db } from "@eleva/db"\nexport const x = db\n',
  })
  assert.deepEqual(
    skipped.problems.map((one) => one.split(": ")[0]),
    ["apps/demo/src/lib/.turbo/hidden.ts"]
  )
  assert.match(skipped.problems[0], /is not linted/)

  // A lint config inside a folder, which would switch lint off under it.
  const nested = await checkScratch({
    "src/app/legacy/eslint.config.js": 'export default [{ ignores: ["**"] }]\n',
    "src/app/legacy/page.ts":
      'import { db } from "@eleva/db"\nexport const x = db\n',
  })
  assert.ok(
    nested.problems.some((one) =>
      /^apps\/demo\/src\/app\/legacy\/eslint\.config\.js: an app has one lint config/.test(
        one
      )
    ),
    nested.problems.join("\n")
  )

  // A folder with a generated folder's name, deeper down, is ours.
  const deeper = await checkScratch({
    "src/app/test-results/page.ts":
      'import { db } from "@eleva/db"\nexport const x = db\n',
  })
  assert.equal(deeper.problems.length, 1, deeper.problems.join("\n"))
  assert.match(deeper.problems[0], /test-results\/page\.ts:1: /)
})

test("an app whose lint config is the right text over other configs is named", async () => {
  // The lint package as a copy: the same text in the app's config, other
  // objects behind the names. And in the copy, a rule off for one folder.
  const { root, app } = scratchRepository({
    "src/app/legacy/page.ts":
      'import { db } from "@eleva/db"\nexport const x = db\n',
  })
  const real = path.join(ROOT, "packages", "eslint-config")
  const copy = path.join(app, "node_modules", "@eleva", "eslint-config")
  rmSync(copy)
  mkdirSync(copy)
  for (const name of readdirSync(real)) {
    if (name.endsWith(".js") || name === "package.json") {
      cpSync(path.join(real, name), path.join(copy, name))
    }
  }
  symlinkSync(path.join(real, "node_modules"), path.join(copy, "node_modules"))
  const reads = path.join(copy, "frontend-db-reads.js")
  writeFileSync(
    reads,
    readFileSync(reads, "utf8") +
      '\nfrontendDbReadsConfig.push({ files: ["src/app/legacy/**"], rules: { "@typescript-eslint/no-restricted-imports": "off" } })\n'
  )

  const { problems } = await findBoundaryProblems(root, {
    workspaces: ["apps/demo"],
  })
  // What the file exports is not the shared configs...
  assert.ok(
    problems.some((one) =>
      /^apps\/demo: the lint config of an app is/.test(one)
    ),
    problems.join("\n")
  )
  // ...and the folder where the rule is off is named, though lint found
  // nothing there.
  assert.ok(
    problems.some((one) =>
      /^apps\/demo\/src\/app\/legacy\/page\.ts: the boundary rules are not set/.test(
        one
      )
    ),
    problems.join("\n")
  )
  assert.ok(!problems.some((one) => /legacy\/page\.ts:1: /.test(one)))
})

test("an app whose lint config is other code is named, and its code is not run", async () => {
  const marker = path.join(temporary(), "ran")
  const original = readFileSync(
    path.join(ROOT, "apps", "academy", "eslint.config.js"),
    "utf8"
  )
  const { problems } = await checkScratch({
    // Were this loaded, it would leave a file behind, and end the run.
    "eslint.config.js": `import { writeFileSync } from "node:fs"
writeFileSync(${JSON.stringify(marker)}, "ran")
process.exit(0)
${original}`,
    "src/app/x/page.ts":
      'import { db } from "@eleva/db"\nexport const x = db\n',
  })
  assert.equal(problems.length, 1, problems.join("\n"))
  assert.match(problems[0], /^apps\/demo: the lint config of an app is/)
  assert.throws(() => statSync(marker), /ENOENT/)
})

test("a link to code outside an app is named", async () => {
  const outside = temporary()
  writeFileSync(
    path.join(outside, "page.ts"),
    'import { db } from "@eleva/db"\nexport const x = db\n'
  )
  const { root, app } = scratchRepository({})
  symlinkSync(outside, path.join(app, "src", "linked"))
  symlinkSync(path.join(outside, "page.ts"), path.join(app, "src", "one.ts"))
  // A link that is not code, as `.env.local` is in every app.
  writeFileSync(path.join(outside, "env"), "A=1\n")
  symlinkSync(path.join(outside, "env"), path.join(app, ".env.local"))
  const { problems } = await findBoundaryProblems(root, {
    workspaces: ["apps/demo"],
  })
  assert.deepEqual(
    problems
      .filter((one) => / is a link\./.test(one))
      .map((one) => one.split(": ")[0]),
    ["apps/demo/src/linked", "apps/demo/src/one.ts"]
  )
})

test("one small app, checked whole: clean, and its canaries are refused", async () => {
  const { problems, files } = await findBoundaryProblems(ROOT, {
    workspaces: ["apps/academy"],
  })
  assert.deepEqual(problems, [])
  assert.ok(files > 5)
})

test("an app whose config leaves the database rule out is named", async () => {
  // apps/api owns the database and does not have the frontend rule. Asked
  // to refuse what a frontend must refuse, it lets all of it through.
  const { problems } = await findBoundaryProblems(ROOT, {
    workspaces: ["apps/api"],
    canaries: () => canariesFor("apps/web"),
  })
  assert.equal(problems.length, 4, problems.join("\n"))
  for (const problem of problems) {
    assert.match(problem, /^apps\/api: the lint config lets through /)
  }
})

test("a workspace that cannot be linted is named, and fails", async () => {
  const { problems } = await findBoundaryProblems(ROOT, {
    workspaces: ["apps/no-such-app"],
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /^apps\/no-such-app: could not be checked \(/)
})

test("which apps must refuse what", () => {
  assert.deepEqual(canariesFor("packages/billing"), [])
  const api = canariesFor("apps/api").map((canary) => canary.what)
  const web = canariesFor("apps/web").map((canary) => canary.what)
  assert.equal(api.length, 2)
  assert.equal(web.length, 6)
  // The API refuses what every app refuses, and may take the database.
  for (const what of api) assert.ok(web.includes(what))
  assert.ok(!api.some((what) => /database/.test(what)))
})

test("a frontend takes the listed reads and types from the database, and no more", async () => {
  const lines = [
    line('import { getExpertProfileForOrg, listSchedules } from "@eleva/db"'),
    line(
      'import { toBookingLinkListItem, getEventType as one } from "@eleva/db"'
    ),
    line('import type { ExpertProfile, createEventType } from "@eleva/db"'),
    line('import { type SessionMode } from "@eleva/db"'),
    line('import type { Booking } from "@eleva/db/schema"'),
    // A write, a handle, the whole package.
    line('import { updateSchedule } from "@eleva/db"', DB_RULE),
    line('import { db } from "@eleva/db"', DB_RULE),
    line(
      'import { withPlatformAdminContext as asAll } from "@eleva/db"',
      DB_RULE
    ),
    line('import * as everything from "@eleva/db"', DB_RULE),
    line('import whole from "@eleva/db"', DB_RULE),
    line('export { deleteEventType } from "@eleva/db"', DB_RULE),
    line('export * from "@eleva/db"', DB_RULE),
    // Reads, by their names, that are not on the list: they read as the
    // platform, by a bare id.
    line('import { getMemberProfile } from "@eleva/db"', DB_RULE),
    line('import { listMemberPayments } from "@eleva/db"', DB_RULE),
    line('import { getAuthUserRole } from "@eleva/db"', DB_RULE),
    // Subpaths, and the name with something after it.
    line('import { main } from "@eleva/db/schema"', DB_RULE),
    line(
      'import { listPartnerApplications } from "@eleva/db/queries/partner-applications"',
      DB_RULE
    ),
    line('import raw from "@eleva/db?raw"', DB_RULE),
    // What is under the package.
    line('import { sql } from "drizzle-orm"', DB_RULE),
    line('import { eq } from "drizzle-orm/pg-core"', DB_RULE),
    line('import { neon } from "@neondatabase/serverless"', DB_RULE),
    line('import { Client } from "pg/lib/client"', DB_RULE),
    line('import postgres from "postgres"', DB_RULE),
    // The package by its place on disk: any workspace by path is refused.
    line(
      'import { client } from "../../../../packages/db/src/client"',
      "no-restricted-imports"
    ),
    line(
      'import { a } from "../../packages/auth/../db/src/index"',
      "no-restricted-imports"
    ),
    line(
      'import { b } from "../../node_modules/@eleva/db/src/index"',
      "no-restricted-imports"
    ),
    line('import { c } from "../../apps/poc/src/x"', "no-restricted-imports"),
    // Loaded at run time, written as text.
    line('export const l1 = () => import("@eleva/db")', "no-restricted-syntax"),
    line("export const l2 = () => import(`@eleva/db`)", "no-restricted-syntax"),
    line(
      'export const l3 = () => import("@eleva/db" as string)',
      "no-restricted-syntax"
    ),
    line(
      'export const l4 = () => import("../../../packages/db/src/index")',
      "no-restricted-syntax"
    ),
    line(
      'export const l5 = () => import("drizzle-orm")',
      "no-restricted-syntax"
    ),
    line(
      'export const l6 = require("@eleva/db/client")',
      "no-restricted-syntax"
    ),
    line(
      'export const l7 = module.require("@eleva/db")',
      "no-restricted-syntax"
    ),
    line(
      'export const l8 = createRequire(import.meta.url)("@eleva/db")',
      "no-restricted-syntax"
    ),
    line(
      'export const l9 = require("@eleva/db" as string)',
      "no-restricted-syntax"
    ),
    line(
      'export const l10 = require.resolve("drizzle-orm")',
      "no-restricted-syntax"
    ),
    // A folder of the app's own named like a workspace folder is not one.
    line('import { list } from "./packages/list"'),
    line('import { card } from "@/components/apps/app-card"'),
    line('import type { Plan } from "../packages/types"'),
    // A type from the query builder is not a query.
    line('import type { InferSelectModel } from "drizzle-orm"'),
    // What a test loads past its own mock is a load.
    line(
      'const real = await vi.importActual("@eleva/db")',
      "no-restricted-syntax"
    ),
    // Text that names the database and loads nothing.
    line('export const fine = () => import("@eleva/ui/components/button")'),
    line('vi.mock("@eleva/db", () => ({}))'),
    line('console.log("drizzle-orm", ["@eleva/db"].includes("@eleva/db"))'),
    line('export const where = path.resolve(here, "../../packages/content")'),
    line('export const label = t("database")'),
  ]
  for (const app of ["apps/expert", "apps/web", "apps/account", "apps/email"]) {
    await expectLines(app, "src/app/thing/page.tsx", lines)
  }
})

test("the list of reads has no name that is gone or unused", () => {
  const index = readFileSync(
    path.join(ROOT, "packages", "db", "src", "index.ts"),
    "utf8"
  )
  // The names the package exports as values: `export { a, b } from "…"`.
  const exported = new Set(
    [...index.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(([, names]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name && !name.startsWith("type "))
        .map((name) => name.split(/\s+as\s+/).at(-1))
    )
  )
  assert.ok(exported.size > 100, `${exported.size} exports read`)

  const used = new Set()
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue
      const file = path.join(dir, name)
      if (statSync(file).isDirectory()) walk(file)
      else if (/\.tsx?$/.test(name)) {
        const source = readFileSync(file, "utf8")
        for (const [, names] of source.matchAll(
          /import\s*\{([^}]*)\}\s*from\s*"@eleva\/db"/g
        )) {
          for (const one of names.split(",")) {
            used.add(
              one
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)[0]
            )
          }
        }
      }
    }
  }
  for (const app of readdirSync(path.join(ROOT, "apps"))) {
    const dir = path.join(ROOT, "apps", app)
    if (app === "api" || app === "poc" || !statSync(dir).isDirectory()) continue
    walk(dir)
  }

  assert.deepEqual([...FRONTEND_DB_READS].sort(), FRONTEND_DB_READS)
  assert.equal(new Set(FRONTEND_DB_READS).size, FRONTEND_DB_READS.length)
  for (const name of FRONTEND_DB_READS) {
    assert.ok(exported.has(name), `${name} is exported by @eleva/db`)
    assert.ok(used.has(name), `${name} is used by an app`)
    assert.match(
      name,
      /^(get|list|count|to)[A-Z]/,
      `${name} is named as a read`
    )
  }
})

test("a comment in a file does not switch a boundary off", async () => {
  const code = [
    "/* eslint-disable */",
    "/* eslint @typescript-eslint/no-restricted-imports: off, no-restricted-imports: off */",
    "// eslint-disable-next-line @typescript-eslint/no-restricted-imports",
    'import { db } from "@eleva/db"',
    "// eslint-disable-next-line no-restricted-imports",
    'import Stripe from "stripe"',
    "export const all = [db, Stripe]",
    "",
  ].join("\n")
  assert.deepEqual(
    await refused("apps/expert", "src/app/thing/page.tsx", code),
    [
      { line: 4, rule: DB_RULE },
      { line: 6, rule: "no-restricted-imports" },
    ]
  )
  // What the check is for: with comments obeyed, both would pass.
  const obeyed = await refused("apps/expert", "src/app/thing/page.tsx", code, {
    allowInlineConfig: true,
  })
  assert.deepEqual(
    obeyed.filter((one) => one.rule),
    []
  )
})

test("a file whose rules are not the shared ones is named", async () => {
  const cwd = path.join(ROOT, "apps", "expert")
  const file = (name) => path.join(cwd, "src", "app", name, "page.tsx")
  const files = [file("legacy"), file("other"), file("reset"), file("through")]
  const check = (overrideConfig) =>
    filesWithOtherRules(
      createEslint(ROOT, cwd, { overrideConfig }),
      ROOT,
      "apps/expert",
      files
    )

  assert.deepEqual(await check([]), [])
  const other = await check([
    {
      files: ["src/app/legacy/**"],
      rules: { "@typescript-eslint/no-restricted-imports": "off" },
    },
    {
      // The rule is still on, and bans something else: the vendor bans
      // are gone from this folder. This is what took them off actions.ts.
      files: ["src/app/reset/**"],
      rules: {
        "no-restricted-imports": ["error", { paths: [{ name: "lodash" }] }],
      },
    },
    {
      // A processor decides what the rules get to see.
      files: ["src/app/through/**"],
      processor: { preprocess: () => [], postprocess: () => [] },
    },
  ])
  assert.deepEqual(
    other.map((problem) => problem.split(": ")[0]),
    ["legacy", "reset", "through"].map(
      (name) => `apps/expert/src/app/${name}/page.tsx`
    )
  )
  // The same rule weakened for the whole app, not for a folder.
  const weakened = await check([
    { rules: { "no-restricted-syntax": ["error", "DebuggerStatement"] } },
  ])
  assert.equal(weakened.length, files.length)
})

test("every source file of an app is found, and a lint config inside it", () => {
  const app = temporary()
  const write = (file, text = "export {}\n") => {
    mkdirSync(path.dirname(path.join(app, file)), { recursive: true })
    writeFileSync(path.join(app, file), text)
  }
  write("eslint.config.js")
  write("next.config.mjs")
  write("src/proxy.ts")
  write("src/app/page.tsx")
  write("src/app/legacy/eslint.config.js")
  write("src/app/notes.md", "not source")
  // What tools generate, at the top of the app, is not ours.
  write("coverage/lcov-report/index.js")
  write("node_modules/x/index.js")
  write(".next/server/app.js")
  write("dist/index.js")
  // The same names deeper down are folders like any other.
  write("src/app/coverage/page.tsx")
  write("src/app/dist/page.tsx")
  write("src/lib/node_modules/evil/index.ts")
  write("src/lib/.turbo/evil.ts")
  const { sources, configs, links } = sourceFilesOf(app)
  const relative = (files) =>
    files.map((file) => path.relative(app, file)).sort()
  assert.deepEqual(relative(sources), [
    "next.config.mjs",
    "src/app/coverage/page.tsx",
    "src/app/dist/page.tsx",
    "src/app/page.tsx",
    "src/lib/.turbo/evil.ts",
    "src/lib/node_modules/evil/index.ts",
    "src/proxy.ts",
  ])
  assert.deepEqual(relative(configs), [
    "eslint.config.js",
    "src/app/legacy/eslint.config.js",
  ])
  assert.deepEqual(links, [])
})

test("the API may take what it needs from the database", async () => {
  await expectLines("apps/api", "src/app/thing/route.ts", [
    line('import { db, updateSchedule } from "@eleva/db"'),
    line('import { main } from "@eleva/db/schema"'),
    line('import { sql } from "drizzle-orm"'),
    line("export const all = [db, updateSchedule, main, sql]"),
  ])
})

test("every app keeps the vendor and health-data boundaries, in every file", async () => {
  // A config for `actions.ts` once set the import rule again for those
  // files, which took the vendor bans off them without a word.
  const lines = [
    line('import Stripe from "stripe"', "no-restricted-imports"),
    line('import { Resend } from "resend"', "no-restricted-imports"),
    line(
      'import type Later from "stripe/lib/resources"',
      "no-restricted-imports"
    ),
    line('import { S3 } from "@aws-sdk/client-s3"', "no-restricted-imports"),
    line(
      "export const r1 = (value: { reveal(): string }) => value.reveal()",
      "no-restricted-syntax"
    ),
    line(
      'export const r2 = (value: { reveal(): string }) => value["reveal"]()',
      "no-restricted-syntax"
    ),
    line(
      "export const r3 = (value: { reveal(): string }) => value[`reveal`]()",
      "no-restricted-syntax"
    ),
    line(
      "export const r4 = (value: { reveal(): string }) => value.reveal.call(value)",
      "no-restricted-syntax"
    ),
    line('export const v1 = () => import("stripe")', "no-restricted-syntax"),
    line('export const v2 = require("twilio")', "no-restricted-syntax"),
    // The run-time bans are the import bans: every banned module.
    line(
      'export const v3 = () => import("better-auth")',
      "no-restricted-syntax"
    ),
    line('export const v4 = require("lucide-react")', "no-restricted-syntax"),
    line(
      'export const v5 = () => import("@radix-ui/react-dialog")',
      "no-restricted-syntax"
    ),
    line("export const v6 = () => import(`stripe`)", "no-restricted-syntax"),
    line('export const v7 = module.require("stripe")', "no-restricted-syntax"),
    line("export const all = [Stripe, Resend, S3]"),
    line('export const fine = () => import("./stripe-button")'),
    // Names that only begin like a banned module, and calls that load
    // nothing.
    line('export const kinds = () => import("stripe-event-types")'),
    line('describe.each([1])("stripe", () => {})'),
    line('export const field = form.require("ai")'),
    line('export const label = useTranslations("providers")("resend")'),
  ]
  for (const app of ["apps/expert", "apps/account", "apps/admin", "apps/api"]) {
    await expectLines(app, "src/app/thing/actions.ts", lines)
  }
})

test("the shared configs set each boundary rule for every file, or not at all", () => {
  // The check reads "what the shared configs set" as the last entry that
  // sets a rule. That is only true while no entry sets one for some files.
  const everyFile = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
  for (const workspace of ["apps/web", "apps/api"]) {
    for (const entry of sharedConfigsFor(workspace).flat()) {
      for (const rule of [
        "no-restricted-imports",
        "@typescript-eslint/no-restricted-imports",
        "no-restricted-syntax",
      ]) {
        if (entry.rules?.[rule] === undefined) continue
        assert.ok(
          entry.files === undefined ||
            (entry.files.length === 1 && entry.files[0] === everyFile),
          `${rule} is set for ${JSON.stringify(entry.files)} only`
        )
      }
    }
  }
})

test("the run-time bans are the import bans, name for name", () => {
  const text = modulesAsText([
    "stripe",
    "stripe/**",
    "@ai-sdk/**",
    "ai",
    "ai/*",
    "slate-*",
  ])
  const pattern = new RegExp(text.slice(1, -1))
  for (const banned of [
    "stripe",
    "stripe/lib/x",
    "@ai-sdk/openai",
    "ai",
    "ai/rsc",
    "slate-react",
  ]) {
    assert.ok(pattern.test(banned), banned)
  }
  // A name that only begins the same way is another package.
  for (const allowed of [
    "stripe-event-types",
    "aim",
    "ai-sdk",
    "slated",
    "@ai-sdkx/y",
  ]) {
    assert.ok(!pattern.test(allowed), allowed)
  }
})

test("only boundary rules count as findings", () => {
  const file = path.join(ROOT, "apps", "web", "src", "page.tsx")
  const results = [
    {
      filePath: file,
      messages: [
        { ruleId: "no-restricted-imports", line: 3, message: "no stripe" },
        { ruleId: "@typescript-eslint/no-unused-vars", line: 4, message: "x" },
        { ruleId: null, line: 1, message: "File ignored" },
        { ruleId: "no-restricted-syntax", line: 9, message: "no reveal" },
      ],
    },
  ]
  assert.deepEqual(boundaryFindings(ROOT, results), [
    "apps/web/src/page.tsx:3: no stripe (no-restricted-imports)",
    "apps/web/src/page.tsx:9: no reveal (no-restricted-syntax)",
  ])
})

test("a file that cannot be parsed is a finding, not a pass", async () => {
  const cwd = path.join(ROOT, "apps", "web")
  const results = await createEslint(ROOT, cwd).lintText(
    "export const broken = (;\n",
    { filePath: path.join(cwd, "src", "app", "broken.ts") }
  )
  const found = boundaryFindings(ROOT, results)
  assert.equal(found.length, 1, found.join("\n"))
  assert.match(
    found[0],
    /^apps\/web\/src\/app\/broken\.ts:1: could not be read/
  )
})
