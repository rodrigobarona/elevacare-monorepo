import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { boundariesConfig } from "../packages/eslint-config/boundaries.js"
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
  sharedConfigsFor,
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

test("run as CI runs it, through a link too: the repository passes", () => {
  // A script that only runs when called by its own path would pass,
  // having checked nothing, when called through a link.
  const link = path.join(temporary(), "check.mjs")
  symlinkSync(SCRIPT, link)
  const run = spawnSync(process.execPath, [link], { encoding: "utf8" })
  assert.equal(run.status, 0, run.stderr)
  const [, files, workspaces] = run.stdout.match(
    /^Boundary check passed \((\d+) files in (\d+) workspaces\)\.$/m
  )
  // Every workspace with a lint config, and no app left out.
  assert.equal(Number(workspaces), lintedWorkspaces(ROOT).length)
  assert.ok(Number(files) > Number(workspaces))
  assert.deepEqual(appsWithoutLint(ROOT), [])
  const apps = lintedWorkspaces(ROOT).filter((name) => name.startsWith("apps/"))
  for (const app of ["apps/api", "apps/web", "apps/expert", "apps/admin"]) {
    assert.ok(apps.includes(app), `${app} is linted`)
  }
  assert.ok(!apps.includes("apps/poc"), "the playground is not linted")
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
  // Nothing linted is not a pass.
  assert.equal(
    report("/repo", { problems: [], files: 0, workspaces: 3 }).code,
    1
  )
  assert.equal(
    report("/repo", { problems: [], files: 0, workspaces: 0 }).code,
    1
  )
})

test("an app's lint config is the shared configs, and nothing else", () => {
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
    assert.match(
      problems[0],
      new RegExp(`^${workspace}/eslint\\.config\\.js: `)
    )
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

test("every app's own lint config is exactly that", async () => {
  for (const app of lintedWorkspaces(ROOT)) {
    if (!app.startsWith("apps/")) continue
    const config = await import(path.join(ROOT, app, "eslint.config.js"))
    assert.deepEqual(appConfigProblems(app, config.default), [], app)
  }
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
    // Subpaths, the package by its place on disk, what is under it.
    line('import { main } from "@eleva/db/schema"', DB_RULE),
    line(
      'import { listPartnerApplications } from "@eleva/db/queries/partner-applications"',
      DB_RULE
    ),
    line(
      'import { client } from "../../../../packages/db/src/client"',
      DB_RULE
    ),
    line('import { a } from "../../packages/./db/src/index"', DB_RULE),
    line('import { b } from "../../node_modules/@eleva/db/src/index"', DB_RULE),
    line('import { sql } from "drizzle-orm"', DB_RULE),
    line('import { eq } from "drizzle-orm/pg-core"', DB_RULE),
    line('import { neon } from "@neondatabase/serverless"', DB_RULE),
    line('import { Client } from "pg/lib/client"', DB_RULE),
    line('import postgres from "postgres"', DB_RULE),
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
    // Text that is not the database.
    line('export const fine = () => import("@eleva/ui/components/button")'),
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
  write("src/app/coverage/page.tsx") // a route named coverage is ours
  write("src/app/legacy/eslint.config.js")
  write("src/app/notes.md", "not source")
  write("coverage/lcov-report/index.js") // the report is not
  write("node_modules/x/index.js")
  write(".next/server/app.js")
  const { sources, configs } = sourceFilesOf(app)
  const relative = (files) =>
    files.map((file) => path.relative(app, file)).sort()
  assert.deepEqual(relative(sources), [
    "next.config.mjs",
    "src/app/coverage/page.tsx",
    "src/app/page.tsx",
    "src/proxy.ts",
  ])
  assert.deepEqual(relative(configs), [
    "eslint.config.js",
    "src/app/legacy/eslint.config.js",
  ])
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
    line("export const all = [Stripe, Resend, S3]"),
    line('export const fine = () => import("./stripe-button")'),
  ]
  for (const app of ["apps/expert", "apps/account", "apps/admin", "apps/api"]) {
    await expectLines(app, "src/app/thing/actions.ts", lines)
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
