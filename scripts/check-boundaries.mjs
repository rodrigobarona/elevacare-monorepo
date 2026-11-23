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
 * It also checks that nothing switches the rules off by mistake:
 * - an app's lint config is the shared configs, in order, and nothing
 *   else: its file is those few lines and no other code
 *   (`appConfigProblems`). A rule set again, a folder ignored, a
 *   processor: all of that is an addition, and fails. What an app needs
 *   changed goes into `@eleva/eslint-config`, where it is reviewed once;
 * - every file of an app has the boundary rules set exactly as the shared
 *   configs set them, and every source file of an app is linted;
 * - in each app a few lines that must be refused are linted, and are;
 * - comments in a file (`eslint-disable`) are not obeyed, and a file that
 *   cannot be parsed is a finding, not a pass.
 *
 * What this is for, and what it is not. It stops a boundary from being
 * crossed or switched off by mistake, or quietly, in an ordinary change.
 * It does not stand against someone who sets out to defeat it: a lint
 * config is code, the shared configs and this script can be edited, and
 * the CI step can be removed. Review is what stands against that.
 *
 * What it cannot see:
 * - a module name put together at run time (`import("@eleva/" + name)`),
 *   or reached through an alias (`imports` in package.json, `paths` in
 *   tsconfig.json);
 * - packages. A package has its own lint config, so one that wraps a
 *   vendor can allow it; only its findings are checked here, not what its
 *   config leaves out, and a frontend can reach the database through a
 *   package that offers it.
 *
 * `node scripts/check-boundaries.mjs apps/web packages/ui` checks only
 * the workspaces named.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs"
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

/**
 * Folders at the top of an app that hold no source of ours: what tools
 * generate there. Deeper down, a folder with one of these names is a
 * folder like any other.
 */
const NOT_OURS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".vercel",
  ".react-email",
  ".source",
  "coverage",
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

const SHARED_CONFIGS = {
  nextJsConfig: "@eleva/eslint-config/next-js",
  config: "@eleva/eslint-config/base",
  boundariesConfig: "@eleva/eslint-config/boundaries",
  frontendDbReadsConfig: "@eleva/eslint-config/frontend-db-reads",
}

/** The shared configs an app spreads, by name, in order: both ways to begin. */
function sharedNamesFor(workspace) {
  const rest =
    workspace === DATABASE_OWNER
      ? ["boundariesConfig"]
      : ["boundariesConfig", "frontendDbReadsConfig"]
  return [
    ["nextJsConfig", ...rest],
    ["config", ...rest],
  ]
}

/** What an app's lint config file is, written out (the Next.js one). */
export function sharedConfigText(workspace) {
  const [names] = sharedNamesFor(workspace)
  return [
    ...names.map((name) => `import { ${name} } from "${SHARED_CONFIGS[name]}"`),
    "",
    `export default [${names.map((name) => `...${name}`).join(", ")}]`,
    "",
  ].join("\n")
}

/**
 * Whether a lint config file is those lines and no other code. How it is
 * laid out does not count: comments, spacing, quotes, semicolons, a comma
 * after the last entry, the order of the imports.
 */
export function isSharedConfigText(workspace, source) {
  const bare = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/[\s;]/g, "")
    .replace(/'/g, '"')
    .replace(/,\]/g, "]")
  const imports = bare.match(/import\{\w+\}from"[^"]+"/g) ?? []
  const rest = imports.reduce((text, one) => text.replace(one, ""), bare)
  return sharedNamesFor(workspace).some(
    (names) =>
      imports.length === names.length &&
      names.every((name) =>
        imports.includes(`import{${name}}from"${SHARED_CONFIGS[name]}"`)
      ) &&
      rest === `exportdefault[${names.map((name) => `...${name}`).join(",")}]`
  )
}

/**
 * What is wrong with an app's lint config: anything but the shared
 * configs. Given `source`, the file's text: it must be those lines and no
 * other code, because the file is code and could change the shared
 * configs as it loads and still export them. Given `config`, what the
 * file exports: the shared configs themselves, entry for entry.
 */
export function appConfigProblems(workspace, config, source) {
  const same = (expected) =>
    Array.isArray(config) &&
    config.length === expected.length &&
    config.every((entry, index) => entry === expected[index])
  const ok =
    source === undefined
      ? sharedConfigsFor(workspace).some(same)
      : isSharedConfigText(workspace, source)
  if (ok) return []
  return [
    `${workspace}: the lint config of an app is the shared configs and nothing else, so the app was not checked further. Anything more (a rule set here, a folder ignored, any other code) or less can switch a boundary off; put the change in @eleva/eslint-config. The file should read:\n\n${sharedConfigText(
      workspace
    )
      .trim()
      .replace(
        /^/gm,
        "    "
      )}\n\n  (a non-Next.js app begins from { config } of "@eleva/eslint-config/base")`,
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
  return (
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `apps/${entry.name}`)
      // A folder left behind by another branch, with no package in it, is
      // not an app.
      .filter((app) => existsSync(path.join(root, app, "package.json")))
      .filter((app) => !SKIPPED.has(app) && !linted.has(app))
      .sort()
  )
}

function leadsToFolder(link) {
  try {
    return statSync(link).isDirectory()
  } catch {
    // A link to nothing leads nowhere.
    return false
  }
}

/**
 * Every source file of ours under an app, every lint config in it, and
 * every link: a link can point at code that is not under the app.
 */
export function sourceFilesOf(cwd) {
  const sources = []
  const configs = []
  const links = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (dir === cwd && NOT_OURS.has(entry.name)) continue
      const file = path.join(dir, entry.name)
      const source = SOURCE_FILE.test(entry.name)
      if (entry.isSymbolicLink()) {
        // `.env.local` is linked in by the tooling; code is not.
        if (source || leadsToFolder(file)) links.push(file)
      } else if (entry.isDirectory()) {
        walk(file)
      } else if (/^eslint\.config\./.test(entry.name)) {
        configs.push(file)
      } else if (source) {
        sources.push(file)
      }
    }
  }
  walk(cwd)
  return { sources, configs, links }
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

  const file = configFile(cwd)
  const config = (await import(pathToFileURL(file).href)).default
  problems.push(...appConfigProblems(workspace, config))

  const linted = new Set(results.map((result) => result.filePath))
  const { sources, configs, links } = sourceFilesOf(cwd)
  for (const file of sources) {
    if (!linted.has(file)) {
      problems.push(
        `${path.relative(root, file)}: is not linted (a lint config ignores it), so no boundary rule runs on it`
      )
    }
  }
  for (const other of configs) {
    if (other !== file) {
      problems.push(
        `${path.relative(root, other)}: an app has one lint config, at its top. A second one, or one inside a folder, replaces it for the files beside it`
      )
    }
  }
  for (const link of links) {
    problems.push(
      `${path.relative(root, link)}: is a link. Code reached through a link is not under the app, so nothing here checks it`
    )
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
      const cwd = path.join(root, workspace)
      if (workspace.startsWith("apps/")) {
        // Read as text before it is run: loading a config runs its code.
        const text = appConfigProblems(
          workspace,
          undefined,
          readFileSync(configFile(cwd), "utf8")
        )
        if (text.length > 0) {
          problems.push(...text)
          continue
        }
      }
      const eslint = createEslint(root, cwd)
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
        ...problems.map((problem) => `- ${problem}`),
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
  // With names, only those workspaces: for a quick look at one.
  const asked = process.argv.slice(2).map((name) => name.replace(/\/+$/, ""))
  const known = lintedWorkspaces(root)
  const unknown = asked.filter((name) => !known.includes(name))
  if (unknown.length > 0) {
    console.error(
      `Boundary check failed. Not a workspace with a lint config: ${unknown.join(", ")}`
    )
    process.exit(1)
  }
  const found = await findBoundaryProblems(
    root,
    asked.length > 0 ? { workspaces: asked } : {}
  )
  const { code, lines } = report(root, found)
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
