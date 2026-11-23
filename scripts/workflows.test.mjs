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
  for (const name of [
    "ci.yml",
    "codeql.yml",
    "sbom.yml",
    "e2e.yml",
    "neon-branch.yml",
  ]) {
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

/**
 * The checkouts of a workflow: for each, whether it says what happens to
 * the token and whether it keeps it. Read without the comments, so a
 * line that is commented out says nothing.
 */
function checkouts(source) {
  return code(source)
    .split(/\n(?=\s*- )/)
    .filter((step) => /uses:\s*actions\/checkout@/.test(step))
    .map((step) => ({
      step: step.trim().split("\n")[0],
      says: /^\s*persist-credentials:\s*(true|false)\s*(#.*)?$/m.test(step),
      keeps: /^\s*persist-credentials:\s*true\s*(#.*)?$/m.test(step),
    }))
}

test("a checkout leaves the token behind only where a later step needs it", () => {
  // The one job that does: gitleaks fetches the base branch after the
  // checkout, to scan the commits a pull request adds.
  const KEEPS_TOKEN = { "ci.yml": 1 }
  for (const [name, source] of Object.entries(WORKFLOWS)) {
    const found = checkouts(source)
    for (const checkout of found) {
      // Said either way, never left to the default (which keeps it).
      assert.ok(checkout.says, `${name}: ${checkout.step}`)
    }
    assert.equal(
      found.filter((checkout) => checkout.keeps).length,
      KEEPS_TOKEN[name] ?? 0,
      `${name}: checkouts that keep the token`
    )
  }
  assert.match(
    WORKFLOWS["ci.yml"],
    /persist-credentials: true\n\s+fetch-depth: 0[\s\S]*?git fetch --no-tags origin "\$BASE_REF"/
  )
})

test("a commented-out line does not count as saying what happens to the token", () => {
  const checkout = (lines) =>
    [
      "jobs:",
      "  build:",
      "    steps:",
      "      - uses: actions/checkout@0123456789012345678901234567890123456789 # v6",
      "        with:",
      ...lines.map((line) => `          ${line}`),
      "      - run: pnpm test",
      "",
    ].join("\n")
  const said = (lines) => checkouts(checkout(lines)).map((one) => one.says)
  const kept = (lines) => checkouts(checkout(lines)).map((one) => one.keeps)

  assert.deepEqual(said(["persist-credentials: false"]), [true])
  assert.deepEqual(kept(["persist-credentials: false"]), [false])
  assert.deepEqual(kept(["persist-credentials: true"]), [true])
  // Left to the default, which keeps the token: not said.
  assert.deepEqual(said(["fetch-depth: 0"]), [false])
  assert.deepEqual(said(["# persist-credentials: false", "fetch-depth: 0"]), [
    false,
  ])
  // A commented-out "true" beside a real "false" keeps nothing.
  assert.deepEqual(
    kept(["# persist-credentials: true", "persist-credentials: false"]),
    [false]
  )
  // A note after the value does not change it.
  assert.deepEqual(kept(["persist-credentials: true # gitleaks"]), [true])
  assert.deepEqual(said(["persist-credentials: false # not needed"]), [true])
  // A word after the value is not the value.
  assert.deepEqual(said(["persist-credentials: falsey"]), [false])
  // The step that follows is its own step.
  assert.equal(checkouts(checkout(["persist-credentials: false"])).length, 1)
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

test("only the scan may write, and only what it finds", () => {
  // Every permission to write, in any workflow, at any level.
  const writes = Object.entries(WORKFLOWS).flatMap(([name, source]) =>
    [...code(source).matchAll(/^\s*([\w-]+): write\s*$/gm)].map(
      (match) => `${name}: ${match[1]}`
    )
  )
  assert.deepEqual(writes, ["codeql.yml: security-events"])
  for (const [name, source] of Object.entries(WORKFLOWS)) {
    assert.doesNotMatch(code(source), /write-all/, name)
  }
})

test("the bills of materials are made on pull requests and on main, and those of main are kept", () => {
  const source = code(WORKFLOWS["sbom.yml"])
  assert.match(source, /\n {2}push:\n {4}branches: \[main\]/)
  assert.match(source, /\n {2}pull_request:\n {4}branches: \[main\]/)
  assert.match(source, /timeout-minutes: \d+/)
  // A run of main is never cancelled by the next one: its files are the
  // record of a commit that was deployed.
  assert.match(
    source,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/
  )
  // Installed first, so that licences can be read.
  assert.ok(
    source.indexOf("pnpm install --frozen-lockfile") <
      source.indexOf("pnpm sbom:apps")
  )
  assert.match(
    source,
    /if: github\.event_name == 'push'\n\s+uses: actions\/upload-artifact@/
  )
  assert.match(source, /name: sbom-\$\{\{ github\.sha \}\}/)
  assert.match(source, /if-no-files-found: error/)
  assert.match(source, /retention-days: 90/)
  // It is given no secret, in a step or for the whole workflow.
  assert.doesNotMatch(source, /secrets\./)
  const scripts = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf8")
  ).scripts
  assert.equal(scripts["sbom:apps"], "node scripts/build-sboms.mjs")
})
