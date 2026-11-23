import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import { FRONTEND_DB_READS } from "../packages/eslint-config/frontend-db-reads.js"
import {
  appsWithoutLint,
  boundaryFindings,
  BOUNDARY_RULES,
  canariesFor,
  filesWithOtherRules,
  findBoundaryProblems,
  lintedWorkspaces,
} from "./check-boundaries.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const { ESLint } = createRequire(
  path.join(ROOT, "packages", "eslint-config", "package.json")
)("eslint")

/** The boundary rules an app's own lint config reports for this source. */
async function refused(app, file, code) {
  const cwd = path.join(ROOT, app)
  // As the check runs it: comments in the file are not obeyed.
  const eslint = new ESLint({
    cwd,
    allowInlineConfig: false,
    ruleFilter: ({ ruleId }) => BOUNDARY_RULES.has(ruleId),
  })
  const [result] = await eslint.lintText(code, {
    filePath: path.join(cwd, file),
  })
  return result.messages.map((message) => ({
    line: message.line,
    rule: message.ruleId,
  }))
}

const DB_RULE = "@typescript-eslint/no-restricted-imports"

test("the repository passes, and every app is checked", async () => {
  const { problems, files, workspaces } = await findBoundaryProblems(ROOT)
  assert.deepEqual(problems, [])
  assert.ok(workspaces >= 40, `${workspaces} workspaces`)
  assert.ok(files >= 1000, `${files} files`)
  assert.deepEqual(appsWithoutLint(ROOT), [])
  const apps = lintedWorkspaces(ROOT).filter((name) => name.startsWith("apps/"))
  for (const app of ["apps/api", "apps/web", "apps/expert", "apps/admin"]) {
    assert.ok(apps.includes(app), `${app} is linted`)
  }
  assert.ok(!apps.includes("apps/poc"), "the playground is not linted")
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
  const code = [
    'import { getExpertProfileForOrg, listSchedules } from "@eleva/db"',
    'import { toBookingLinkListItem, getEventType as eventType } from "@eleva/db"',
    'import type { ExpertProfile, createEventType } from "@eleva/db"',
    'import { type SessionMode } from "@eleva/db"',
    'import type { Booking } from "@eleva/db/schema"',
    // From here on, refused.
    'import { updateSchedule } from "@eleva/db"', // a write
    'import { db } from "@eleva/db"', // a handle
    'import { withPlatformAdminContext as asPlatform } from "@eleva/db"',
    'import * as everything from "@eleva/db"',
    'import whole from "@eleva/db"',
    'import { main } from "@eleva/db/schema"',
    'import { listPartnerApplications } from "@eleva/db/queries/partner-applications"',
    // Reads, by their names, that are not on the list: they read as the
    // platform, by a bare id.
    'import { getMemberProfile } from "@eleva/db"',
    'import { listMemberPayments } from "@eleva/db"',
    'import { getAuthUserRole } from "@eleva/db"',
    'export { deleteEventType } from "@eleva/db"',
    'export * from "@eleva/db"',
    'import { client } from "../../../../../packages/db/src/client"',
    'import { sql } from "drizzle-orm"',
    'import { eq } from "drizzle-orm/pg-core"',
    'import { neon } from "@neondatabase/serverless"',
    'export const lazy = () => import("@eleva/db")',
    "export const lazier = () => import(`@eleva/db`)",
    'export const older = require("@eleva/db/client")',
    "",
  ].join("\n")
  const from = 6
  const to = code.split("\n").length - 1
  const every = Array.from(
    { length: to - from + 1 },
    (_, index) => from + index
  )
  for (const app of ["apps/expert", "apps/web", "apps/account", "apps/email"]) {
    const found = await refused(app, "src/app/thing/page.tsx", code)
    assert.deepEqual(
      [...new Set(found.map((one) => one.line))],
      every,
      `${app}: ${JSON.stringify(found)}`
    )
    assert.deepEqual(
      [
        ...new Set(
          found.filter((one) => one.line <= to - 3).map((one) => one.rule)
        ),
      ],
      [DB_RULE],
      app
    )
    assert.deepEqual(
      [
        ...new Set(
          found.filter((one) => one.line > to - 3).map((one) => one.rule)
        ),
      ],
      ["no-restricted-syntax"],
      app
    )
  }
})

test("the list of reads has no name that is gone or unused", () => {
  const exported = readFileSync(
    path.join(ROOT, "packages", "db", "src", "index.ts"),
    "utf8"
  )
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
  assert.ok(FRONTEND_DB_READS.length >= 10)
  assert.deepEqual([...FRONTEND_DB_READS].sort(), FRONTEND_DB_READS)
  for (const name of FRONTEND_DB_READS) {
    assert.match(exported, new RegExp(`\\b${name}\\b`), `${name} is exported`)
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
  const found = await refused("apps/expert", "src/app/thing/page.tsx", code)
  assert.deepEqual(found, [
    { line: 4, rule: DB_RULE },
    { line: 6, rule: "no-restricted-imports" },
  ])
})

test("a config that switches a boundary off for one folder is named", async () => {
  const cwd = path.join(ROOT, "apps", "expert")
  const file = (name) => path.join(cwd, "src", "app", name, "page.tsx")
  const files = [file("legacy"), file("other"), file("reset")]
  const check = (overrideConfig) =>
    filesWithOtherRules(new ESLint({ cwd, overrideConfig }), ROOT, cwd, files)

  assert.deepEqual(await check([]), [])
  const off = await check([
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
  ])
  assert.equal(off.length, 2, off.join("\n"))
  assert.match(off[0], /^apps\/expert\/src\/app\/legacy\/page\.tsx: /)
  assert.match(off[1], /^apps\/expert\/src\/app\/reset\/page\.tsx: /)
})

test("the API may take what it needs from the database", async () => {
  const found = await refused(
    "apps/api",
    "src/app/thing/route.ts",
    'import { db, updateSchedule } from "@eleva/db"\nimport { main } from "@eleva/db/schema"\nexport const all = [db, updateSchedule, main]\n'
  )
  assert.deepEqual(found, [])
})

test("a Server Action file keeps every boundary", async () => {
  // A config for `actions.ts` once set the import rule again for those
  // files, which took the vendor bans off them without a word.
  const code = [
    'import Stripe from "stripe"',
    'import { Resend } from "resend"',
    'import { createBookingLink } from "@eleva/db"',
    "export const plain = (value: { reveal(): string }) => value.reveal()",
    'import type Later from "stripe/lib/resources"',
    'export const spelled = (value: { reveal(): string }) => value["reveal"]()',
    "export const all = [Stripe, Resend, createBookingLink]",
    "",
  ].join("\n")
  for (const app of ["apps/expert", "apps/account", "apps/admin"]) {
    const found = await refused(app, "src/app/thing/actions.ts", code)
    assert.deepEqual(
      found,
      [
        { line: 1, rule: "no-restricted-imports" },
        { line: 2, rule: "no-restricted-imports" },
        { line: 3, rule: DB_RULE },
        { line: 4, rule: "no-restricted-syntax" },
        { line: 5, rule: "no-restricted-imports" },
        { line: 6, rule: "no-restricted-syntax" },
      ],
      app
    )
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
  const eslint = new ESLint({ cwd, allowInlineConfig: false })
  const results = await eslint.lintText("export const broken = (;\n", {
    filePath: path.join(cwd, "src", "app", "broken.ts"),
  })
  const found = boundaryFindings(ROOT, results)
  assert.equal(found.length, 1, found.join("\n"))
  assert.match(
    found[0],
    /^apps\/web\/src\/app\/broken\.ts:1: could not be read/
  )
})
