import assert from "node:assert/strict"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import {
  appsWithoutLint,
  boundaryFindings,
  BOUNDARY_RULES,
  canariesFor,
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
  const eslint = new ESLint({
    cwd,
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

test("a frontend takes named reads and types from the database, and no more", async () => {
  const code = [
    'import { getExpertProfileForOrg, listSchedules, countBillableSeats } from "@eleva/db"',
    'import { toBookingLinkListItem, isUniqueViolation } from "@eleva/db"',
    'import type { ExpertProfile, createEventType } from "@eleva/db"',
    'import { type SessionMode } from "@eleva/db"',
    'import type { Booking } from "@eleva/db/schema"',
    // From here on, refused.
    'import { updateSchedule } from "@eleva/db"',
    'import { db } from "@eleva/db"',
    'import { withPlatformAdminContext } from "@eleva/db"',
    'import * as everything from "@eleva/db"',
    'import { main } from "@eleva/db/schema"',
    'import { listPartnerApplications } from "@eleva/db/queries/partner-applications"',
    'import { getOrCreateThing } from "@eleva/db"',
    'import { lockEventTypeForUpdate } from "@eleva/db"',
    'export { deleteEventType } from "@eleva/db"',
    'export const lazy = () => import("@eleva/db")',
    'export const older = require("@eleva/db/client")',
    "",
  ].join("\n")
  for (const app of ["apps/expert", "apps/web", "apps/account", "apps/email"]) {
    const found = await refused(app, "src/app/thing/page.tsx", code)
    assert.deepEqual(
      found.map((one) => one.line),
      [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      `${app}: ${JSON.stringify(found)}`
    )
    assert.deepEqual(
      [...new Set(found.slice(0, 9).map((one) => one.rule))],
      [DB_RULE],
      app
    )
    assert.deepEqual(
      found.slice(9).map((one) => one.rule),
      ["no-restricted-syntax", "no-restricted-syntax"],
      app
    )
  }
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
        { ruleId: null, line: 1, message: "Parsing error" },
        { ruleId: "no-restricted-syntax", line: 9, message: "no reveal" },
      ],
    },
  ]
  assert.deepEqual(boundaryFindings(ROOT, results), [
    "apps/web/src/page.tsx:3: no stripe (no-restricted-imports)",
    "apps/web/src/page.tsx:9: no reveal (no-restricted-syntax)",
  ])
})
