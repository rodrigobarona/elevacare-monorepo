import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

/**
 * How every workflow in `.github/workflows` must be written, and what the
 * two that slice 13.13 added must do. Read as text: these rules are about
 * what is written in the files.
 */
const ROOT = path.resolve(import.meta.dirname, "..")
const DIR = path.join(ROOT, ".github", "workflows")
const WORKFLOWS = Object.fromEntries(
  readdirSync(DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => [name, readFileSync(path.join(DIR, name), "utf8")])
)
const names = Object.keys(WORKFLOWS)

/** A workflow without its comments. */
const code = (source) =>
  source
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")

test("the workflows are found", () => {
  for (const name of ["ci.yml", "codeql.yml", "e2e.yml", "neon-branch.yml"]) {
    assert.ok(names.includes(name), name)
  }
})

test("every action is pinned to a commit, with its version beside it", () => {
  for (const [name, source] of Object.entries(WORKFLOWS)) {
    for (const line of source.split("\n")) {
      const uses = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/)
      if (!uses) continue
      // A tag can be moved to other code; a commit cannot.
      assert.match(
        `${uses[1]}${uses[2]}`,
        /^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(\.\d+){0,2}$/,
        `${name}: ${line.trim()}`
      )
    }
  }
})

test("no workflow runs code from a pull request with the repository's own rights", () => {
  for (const [name, source] of Object.entries(WORKFLOWS)) {
    assert.doesNotMatch(code(source), /pull_request_target|workflow_run/, name)
  }
})

test("every workflow says what its token may do, and starts from little", () => {
  for (const [name, source] of Object.entries(WORKFLOWS)) {
    const top = code(source).match(/^permissions:(.*)\n((?: {2}.+\n)*)/m)
    assert.ok(top, `${name}: no permissions at the top`)
    const granted = `${top[1]}\n${top[2]}`
    assert.doesNotMatch(granted, /write-all|: write/, `${name}: ${granted}`)
  }
})

test("a checkout leaves the token behind only where a later step needs it", () => {
  // The one job that does: gitleaks fetches the base branch after the
  // checkout, to scan the commits a pull request adds.
  const KEEPS_TOKEN = { "ci.yml": 1 }
  for (const [name, source] of Object.entries(WORKFLOWS)) {
    let kept = 0
    for (const step of source.split(/\n(?=\s*- )/)) {
      if (!/uses:\s*actions\/checkout@/.test(step)) continue
      // Said either way, never left to the default (which keeps it).
      assert.match(
        step,
        /persist-credentials:\s*(true|false)/,
        `${name}: ${step.trim().split("\n")[0]}`
      )
      if (/persist-credentials:\s*true/.test(step)) kept += 1
    }
    assert.equal(
      kept,
      KEEPS_TOKEN[name] ?? 0,
      `${name}: checkouts that keep the token`
    )
  }
  assert.match(
    WORKFLOWS["ci.yml"],
    /persist-credentials: true\n\s+fetch-depth: 0[\s\S]*?git fetch --no-tags origin "\$BASE_REF"/
  )
})

test("CodeQL scans the product and the workflows, on pull requests, on main and weekly", () => {
  const source = code(WORKFLOWS["codeql.yml"])
  assert.match(source, /\n {2}push:\n {4}branches: \[main\]/)
  assert.match(source, /\n {2}pull_request:\n {4}branches: \[main\]/)
  assert.match(source, /\n {2}schedule:\n\s+- cron: "\d+ \d+ \* \* \d"/)

  // The two languages there are, each without a build, each its own job.
  assert.deepEqual(
    [...source.matchAll(/- language: ([\w-]+)/g)].map((match) => match[1]),
    ["javascript-typescript", "actions"]
  )
  assert.match(source, /build-mode: none/)
  assert.match(source, /fail-fast: false/)
  assert.match(source, /category: "\/language:\$\{\{ matrix\.language \}\}"/)
  assert.match(source, /timeout-minutes: \$\{\{ matrix\.timeout \}\}/)

  // Only the scan may write, and only what it finds.
  const [, job] = source.match(/\n {4}permissions:\n((?: {6}.+\n)+)/)
  assert.deepEqual(
    job
      .trim()
      .split("\n")
      .map((line) => line.trim()),
    ["contents: read", "security-events: write"]
  )
  // It reads no secret, and no text from the event goes into a script.
  assert.doesNotMatch(
    source,
    /secrets\.|github\.event\.[\w.]+ *\}\}.*\n\s+run:|\n\s+run:/
  )
  // A newer push replaces a pull request's scan; a scan of main finishes.
  assert.match(
    source,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/
  )
})

test("CodeQL leaves the reference snapshots and the playground out", () => {
  const config = readFileSync(
    path.join(ROOT, ".github", "codeql", "codeql-config.yml"),
    "utf8"
  )
  const ignored = [...code(config).matchAll(/^ {2}- "?([^"\n]+)"?$/gm)].map(
    (match) => match[1]
  )
  for (const one of ["_context", "apps/poc", "**/node_modules"]) {
    assert.ok(ignored.includes(one), one)
  }
  assert.match(
    WORKFLOWS["codeql.yml"],
    /config-file: \.\/\.github\/codeql\/codeql-config\.yml/
  )
  // The same two paths Renovate leaves out.
  const renovate = JSON.parse(
    readFileSync(path.join(ROOT, "renovate.json"), "utf8")
  )
  assert.deepEqual(renovate.ignorePaths, ["_context/**", "apps/poc/**"])
})

test("CI makes the bills of materials, and keeps those of main", () => {
  const source = code(WORKFLOWS["ci.yml"])
  const [, job] = source.match(
    /\n {2}sbom:\n((?: {4}.*\n|\n)+?)(?=\n {2}[\w-]+:\n)/
  )
  assert.match(job, /timeout-minutes: \d+/)
  // Installed first, so that licences can be read.
  assert.ok(
    job.indexOf("pnpm install --frozen-lockfile") <
      job.indexOf("pnpm sbom:apps")
  )
  assert.match(
    job,
    /if: github\.event_name == 'push'\n\s+uses: actions\/upload-artifact@/
  )
  assert.match(job, /name: sbom-\$\{\{ github\.sha \}\}/)
  assert.match(job, /if-no-files-found: error/)
  assert.match(job, /retention-days: 90/)
  assert.doesNotMatch(job, /permissions:|secrets\./)
  const scripts = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf8")
  ).scripts
  assert.equal(scripts["sbom:apps"], "node scripts/build-sboms.mjs")
})
