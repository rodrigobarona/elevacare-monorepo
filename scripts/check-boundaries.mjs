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
 * It also checks that nothing switches the rules off:
 * - an app's lint config is the shared configs, in order, and nothing
 *   else (`appConfigProblems`). A rule set again, a folder ignored, a
 *   processor: all of that is an addition, and fails. What an app needs
 *   changed goes into `@eleva/eslint-config`, where it is reviewed once;
 * - every file of an app has the boundary rules set exactly as the shared
 *   configs set them, and every source file of an app is linted;
 * - in each app a few lines that must be refused are linted, and are;
 * - comments in a file (`eslint-disable`) are not obeyed, and a file that
 *   cannot be parsed is a finding, not a pass.
 *
 * What it cannot see: a module name put together at run time
 * (`import("@eleva/" + name)`), and packages. A package has its own lint
 * config, so one that wraps a vendor can allow it; only its findings are
 * checked here, not what its config leaves out.
 */
import { existsSync, readdirSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { config as baseConfig } from "../packages/eslint-config/base.js"
import { boundariesConfig } from "../packages/eslint-config/boundaries.js"
import { frontendDbReadsConfig } from "../packages/eslint-config/frontend-db-reads.js"
import { nextJsConfig } from "../packages/eslint-config/next.js"

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

const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

/** Folders of an app that hold no source of ours. */
const NOT_OURS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".vercel",
  ".react-email",
  ".source",
  "dist",
  "playwright-report",
  "test-results",
])

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

/**
 * The shared configs an app's lint config is made of, in order: the base
 * (for a Next.js app, or for one that is not), then the boundaries, then,
 * for every app that does not own the database, what a frontend may take
 * from it.
 */
export function sharedConfigsFor(workspace) {
  const rest =
    workspace === DATABASE_OWNER
      ? boundariesConfig
      : [...boundariesConfig, ...frontendDbReadsConfig]
  return [
    [...nextJsConfig, ...rest],
    [...baseConfig, ...rest],
  ]
}

/**
 * What is wrong with an app's lint config: anything but the shared
 * configs, entry for entry. `config` is what the app's `eslint.config.js`
 * exports.
 */
export function appConfigProblems(workspace, config) {
  const same = (expected) =>
    Array.isArray(config) &&
    config.length === expected.length &&
    config.every((entry, index) => entry === expected[index])
  if (sharedConfigsFor(workspace).some(same)) return []
  const frontend =
    workspace === DATABASE_OWNER ? "" : ", ...frontendDbReadsConfig"
  return [
    `${workspace}/eslint.config.js: an app's lint config is [...nextJsConfig (or the base config), ...boundariesConfig${frontend}] and nothing else. A rule set here, a folder ignored here or an entry left out can switch a boundary off; put the change in @eleva/eslint-config`,
  ]
}

function configFile(dir) {
  return ["js", "mjs", "cjs", "ts"]
    .map((extension) => path.join(dir, `eslint.config.${extension}`))
    .find((file) => existsSync(file))
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
      if (configFile(path.join(dir, name))) found.push(workspace)
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

/** Every source file of ours under an app, and every lint config in it. */
export function sourceFilesOf(cwd) {
  const sources = []
  const configs = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (NOT_OURS.has(entry.name)) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // The coverage report, at the top of the app only.
        if (dir === cwd && entry.name === "coverage") continue
        walk(file)
      } else if (/^eslint\.config\./.test(entry.name)) {
        configs.push(file)
      } else if (SOURCE_FILE.test(entry.name)) {
        sources.push(file)
      }
    }
  }
  walk(cwd)
  return { sources, configs }
}

/** ESLint for one workspace, as this check runs it. */
export function createEslint(root, cwd, options = {}) {
  // ESLint is a dependency of the lint config package, not of the root.
  const require = createRequire(
    path.join(root, "packages", "eslint-config", "package.json")
  )
  const { ESLint } = require("eslint")
  return new ESLint({
    cwd,
    errorOnUnmatchedPattern: false,
    // A comment in a file does not switch a boundary off.
    allowInlineConfig: false,
    ruleFilter: ({ ruleId }) => BOUNDARY_RULES.has(ruleId),
    ...options,
  })
}

/**
 * The boundary findings in what ESLint returned, one line each. A file
 * that could not be parsed counts: no rule ran on it.
 */
export function boundaryFindings(root, results) {
  return results.flatMap((result) =>
    result.messages
      .filter((message) => message.fatal || BOUNDARY_RULES.has(message.ruleId))
      .map((message) =>
        message.fatal
          ? `${path.relative(root, result.filePath)}:${message.line}: could not be read, so no boundary rule ran on it (${message.message})`
          : `${path.relative(root, result.filePath)}:${message.line}: ${message.message} (${message.ruleId})`
      )
  )
}

/** The rules every file of an app must have as the shared configs set them. */
const SAME_IN_EVERY_FILE = [
  "no-restricted-imports",
  "@typescript-eslint/no-restricted-imports",
  "no-restricted-syntax",
]

const SEVERITY = { off: 0, warn: 1, error: 2 }

/** A rule's setting in one form: `[2, ...options]`, or "not set". */
function setting(value) {
  if (value === undefined) return "not set"
  const [severity, ...options] = Array.isArray(value) ? value : [value]
  return JSON.stringify([SEVERITY[severity] ?? severity, ...options])
}

/** What the shared configs set for the boundary rules of an app's files. */
export function sharedSettingsFor(workspace) {
  const [configs] = sharedConfigsFor(workspace)
  return SAME_IN_EVERY_FILE.map((rule) =>
    setting(
      configs
        .map((entry) => entry.rules?.[rule])
        .filter((value) => value !== undefined)
        .at(-1)
    )
  )
}

/**
 * Files of an app whose boundary rules are not set as the shared configs
 * set them (switched off, or set again with other bans), or that go
 * through a processor.
 */
export async function filesWithOtherRules(eslint, root, workspace, files) {
  const shared = sharedSettingsFor(workspace).join("\n")
  const other = []
  for (const file of files) {
    const config = await eslint.calculateConfigForFile(file)
    if (!config) continue
    const here = SAME_IN_EVERY_FILE.map((rule) =>
      setting(config.rules?.[rule])
    ).join("\n")
    if (here !== shared || config.processor) {
      other.push(
        `${path.relative(root, file)}: the boundary rules are not set for this file as @eleva/eslint-config sets them (a lint config switches one off, sets it again, or adds a processor for this path)`
      )
    }
  }
  return other
}

/** What is wrong with one app beyond the findings in its code. */
async function appProblems(root, workspace, eslint, results, canaries) {
  const cwd = path.join(root, workspace)
  const problems = []

  const config = (await import(pathToFileURL(configFile(cwd)).href)).default
  problems.push(...appConfigProblems(workspace, config))

  const linted = new Set(results.map((result) => result.filePath))
  if (linted.size === 0) problems.push(`${workspace}: no file was linted`)
  const { sources, configs } = sourceFilesOf(cwd)
  for (const file of sources) {
    if (!linted.has(file)) {
      problems.push(
        `${path.relative(root, file)}: is not linted (a lint config ignores it), so no boundary rule runs on it`
      )
    }
  }
  for (const file of configs) {
    if (path.dirname(file) !== cwd) {
      problems.push(
        `${path.relative(root, file)}: a lint config inside an app replaces the app's own for that folder; an app has one, at its top`
      )
    }
  }
  problems.push(
    ...(await filesWithOtherRules(eslint, root, workspace, [...linted]))
  )

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
  return problems
}

/**
 * Everything wrong under `root`: boundary findings in the code, and apps
 * where a boundary rule is, or could be, switched off.
 */
export async function findBoundaryProblems(
  root,
  { workspaces = lintedWorkspaces(root), canaries = canariesFor } = {}
) {
  const problems = appsWithoutLint(root).map(
    (app) => `${app}: no eslint.config.js, so no boundary rule checks this app`
  )
  let files = 0

  for (const workspace of workspaces) {
    try {
      const eslint = createEslint(root, path.join(root, workspace))
      const results = await eslint.lintFiles(["."])
      files += results.length
      problems.push(...boundaryFindings(root, results))
      if (workspace.startsWith("apps/")) {
        problems.push(
          ...(await appProblems(root, workspace, eslint, results, canaries))
        )
      }
    } catch (error) {
      // One workspace that cannot be linted fails the check, by name.
      const why = error instanceof Error ? error.message : String(error)
      problems.push(
        `${workspace}: could not be checked (${why.split("\n")[0]})`
      )
    }
  }
  return { problems, files, workspaces: workspaces.length }
}

/** What to print, and the exit code, for what was found. */
export function report(root, { problems, files, workspaces }) {
  if (workspaces === 0 || files === 0) {
    return {
      code: 1,
      lines: [
        `Boundary check failed. Nothing was linted under ${root} (${workspaces} workspaces, ${files} files).`,
      ],
    }
  }
  if (problems.length > 0) {
    return {
      code: 1,
      lines: [
        "Boundary check failed:",
        "",
        ...problems.map((problem) => `- ${problem}`),
      ],
    }
  }
  return {
    code: 0,
    lines: [
      `Boundary check passed (${files} files in ${workspaces} workspaces).`,
    ],
  }
}

async function main() {
  const root = path.resolve(import.meta.dirname, "..")
  const { code, lines } = report(root, await findBoundaryProblems(root))
  for (const line of lines) (code === 0 ? console.log : console.error)(line)
  process.exit(code)
}

// Compared by real path, so that a run through a link is still a run.
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  await main()
}
