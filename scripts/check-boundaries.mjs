#!/usr/bin/env node
/**
 * CI guard: the boundary lint rules fail the build.
 *
 * `@eleva/eslint-config` uses `eslint-plugin-only-warn`, so every finding
 * is a warning and `pnpm lint` exits 0 whatever it finds. The boundary
 * rules are the ones that must not be warnings: a vendor SDK outside the
 * package that owns it, health data unwrapped in an app, a frontend that
 * writes to the database or takes a handle on it. This runs those rules
 * alone, over every workspace that has a lint config, and fails on any
 * finding.
 *
 * It also checks that the rules are switched on: in each app it lints a
 * few lines that must be refused (`CANARIES`). An app whose lint config
 * leaves a rule out, or sets it again and so replaces it, fails here.
 */
import { existsSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** The rules that carry a boundary. Nothing else is run. */
export const BOUNDARY_RULES = new Set([
  "no-restricted-imports",
  "@typescript-eslint/no-restricted-imports",
  "no-restricted-syntax",
  "max-lines",
])

/** Not linted at all: the internal playground. */
const SKIPPED = new Set(["apps/poc"])

/** The one app that owns the database: it takes what it needs from it. */
const DATABASE_OWNER = "apps/api"

const VENDOR = [
  {
    what: "a vendor SDK outside the package that owns it",
    file: "src/__canary__/actions.ts",
    code: 'import Stripe from "stripe"\nexport const stripe = Stripe\n',
    rule: "no-restricted-imports",
  },
  {
    what: "health data unwrapped in an app",
    file: "src/__canary__/page.ts",
    code: "export const text = (value: { reveal(): string }) => value.reveal()\n",
    rule: "no-restricted-syntax",
  },
]

const DATABASE = [
  {
    what: "a database handle in a frontend",
    file: "src/__canary__/page.ts",
    code: 'import { db } from "@eleva/db"\nexport const handle = db\n',
    rule: "@typescript-eslint/no-restricted-imports",
  },
  {
    what: "a database write in a frontend Server Action",
    file: "src/__canary__/actions.ts",
    code: 'import { createEventType } from "@eleva/db"\nexport const write = createEventType\n',
    rule: "@typescript-eslint/no-restricted-imports",
  },
  {
    what: "a raw read from a database subpath in a frontend",
    file: "src/__canary__/page.ts",
    code: 'import { listPartnerApplications } from "@eleva/db/queries/partner-applications"\nexport const read = listPartnerApplications\n',
    rule: "@typescript-eslint/no-restricted-imports",
  },
  {
    what: "the database loaded at run time in a frontend",
    file: "src/__canary__/page.ts",
    code: 'export const lazy = () => import("@eleva/db")\n',
    rule: "no-restricted-syntax",
  },
]

/** What each app must refuse. */
export function canariesFor(workspace) {
  if (!workspace.startsWith("apps/")) return []
  return workspace === DATABASE_OWNER ? VENDOR : [...VENDOR, ...DATABASE]
}

/** Every workspace with a lint config of its own. */
export function lintedWorkspaces(root) {
  const found = []
  for (const group of ["apps", "packages", "infra"]) {
    const dir = path.join(root, group)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).sort()) {
      const workspace = `${group}/${name}`
      if (SKIPPED.has(workspace)) continue
      const hasConfig = ["js", "mjs", "cjs", "ts"].some((extension) =>
        existsSync(path.join(dir, name, `eslint.config.${extension}`))
      )
      if (hasConfig) found.push(workspace)
    }
  }
  return found
}

/** Apps with no lint config: nothing would check them, so they are named. */
export function appsWithoutLint(root) {
  const dir = path.join(root, "apps")
  if (!existsSync(dir)) return []
  const linted = new Set(lintedWorkspaces(root))
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `apps/${entry.name}`)
    .filter((app) => !SKIPPED.has(app) && !linted.has(app))
    .sort()
}

function loadEslint(root) {
  // ESLint is a dependency of the lint config package, not of the root.
  const require = createRequire(
    path.join(root, "packages", "eslint-config", "package.json")
  )
  return require("eslint").ESLint
}

/** The boundary findings in what ESLint returned, one line each. */
export function boundaryFindings(root, results) {
  return results.flatMap((result) =>
    result.messages
      .filter((message) => BOUNDARY_RULES.has(message.ruleId))
      .map(
        (message) =>
          `${path.relative(root, result.filePath)}:${message.line}: ${message.message} (${message.ruleId})`
      )
  )
}

/**
 * Everything wrong under `root`: boundary findings in the code, and apps
 * where a boundary rule is not switched on.
 */
export async function findBoundaryProblems(
  root,
  { workspaces = lintedWorkspaces(root), canaries = canariesFor } = {}
) {
  const ESLint = loadEslint(root)
  const problems = appsWithoutLint(root).map(
    (app) => `${app}: no eslint.config.js, so no boundary rule checks this app`
  )
  let files = 0

  for (const workspace of workspaces) {
    const cwd = path.join(root, workspace)
    const eslint = new ESLint({
      cwd,
      errorOnUnmatchedPattern: false,
      ruleFilter: ({ ruleId }) => BOUNDARY_RULES.has(ruleId),
    })
    const results = await eslint.lintFiles(["."])
    files += results.length
    problems.push(...boundaryFindings(root, results))

    for (const canary of canaries(workspace)) {
      const [result] = await eslint.lintText(canary.code, {
        filePath: path.join(cwd, canary.file),
      })
      const refused = result?.messages.some(
        (message) => message.ruleId === canary.rule
      )
      if (!refused) {
        problems.push(
          `${workspace}: the lint config lets through ${canary.what} (${canary.rule} is off, or set again after the config that sets it)`
        )
      }
    }
  }
  return { problems, files, workspaces: workspaces.length }
}

async function main() {
  const root = path.resolve(import.meta.dirname, "..")
  const { problems, files, workspaces } = await findBoundaryProblems(root)
  if (workspaces === 0 || files === 0) {
    console.error(
      `Boundary check failed. Nothing was linted under ${root} (${workspaces} workspaces, ${files} files).`
    )
    process.exit(1)
  }
  if (problems.length > 0) {
    console.error("Boundary check failed:\n")
    for (const problem of problems) console.error(`- ${problem}`)
    process.exit(1)
  }
  console.log(
    `Boundary check passed (${files} files in ${workspaces} workspaces).`
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
