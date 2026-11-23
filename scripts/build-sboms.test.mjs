import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  buildSboms,
  deployedApps,
  LIMITS,
  NOT_DEPLOYED,
  productionDependencies,
  sbomProblems,
} from "./build-sboms.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const SCRIPT = path.join(import.meta.dirname, "build-sboms.mjs")

const made = []
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})
function temporary() {
  const dir = mkdtempSync(path.join(tmpdir(), "sboms-"))
  made.push(dir)
  return dir
}

/** A workspace of its own: path -> package.json contents. */
function workspace(packages) {
  const root = temporary()
  for (const [dir, manifest] of Object.entries(packages)) {
    mkdirSync(path.join(root, dir), { recursive: true })
    writeFileSync(
      path.join(root, dir, "package.json"),
      JSON.stringify(manifest)
    )
  }
  return root
}

const component = (name, version = "1.0.0") => {
  const [group, short] = name.startsWith("@") ? name.split("/") : [null, name]
  return {
    type: "library",
    ...(group ? { group, name: short } : { name }),
    version,
    purl: `pkg:npm/${name.replaceAll("@", "%40")}@${version}`,
  }
}

/** A bill of materials as pnpm writes one, listing these packages. */
const bomOf = (names, over = {}) => ({
  bomFormat: "CycloneDX",
  specVersion: "1.7",
  metadata: {
    timestamp: "2026-11-23T09:00:00.000Z",
    tools: {
      components: [{ type: "application", name: "pnpm", version: "11.1.2" }],
    },
  },
  components: names.map((name) => component(name)),
  dependencies: [{ ref: "root", dependsOn: [] }],
  ...over,
})

const DEMO = {
  "apps/web": {
    name: "@demo/web",
    version: "1.2.3",
    dependencies: { next: "16.0.0", "@demo/billing": "workspace:*" },
    devDependencies: { vitest: "4.0.0", "@demo/tooling": "workspace:*" },
  },
  "apps/poc": { name: "@demo/poc", dependencies: { three: "1.0.0" } },
  "apps/email": { name: "@demo/email", dependencies: { resend: "1.0.0" } },
  "packages/billing": {
    name: "@demo/billing",
    dependencies: { stripe: "22.0.0", "@demo/db": "workspace:*" },
    optionalDependencies: { "@stripe/extra": "1.0.0" },
  },
  "packages/db": {
    name: "@demo/db",
    dependencies: {
      "drizzle-orm": "1.0.0",
      neon: "npm:@neondatabase/serverless@1.0.0",
      // An alias with no version after it.
      pad: "npm:left-pad",
    },
    devDependencies: { "drizzle-kit": "1.0.0" },
  },
  "packages/tooling": {
    name: "@demo/tooling",
    dependencies: { eslint: "10.0.0" },
  },
}

test("what an app depends on in production reaches through the workspace", () => {
  const root = workspace(DEMO)
  // Its own, its packages', and theirs; under the real name of an alias.
  // Nothing a dev dependency brings in.
  assert.deepEqual(productionDependencies(root, "@demo/web"), [
    "@neondatabase/serverless",
    "@stripe/extra",
    "drizzle-orm",
    "left-pad",
    "next",
    "stripe",
  ])
  assert.throws(
    () => productionDependencies(root, "@demo/nope"),
    /not a workspace package/
  )
})

test("the deployed apps are every app but the playground and the preview tool", () => {
  assert.deepEqual(deployedApps(workspace(DEMO)), [
    { app: "web", name: "@demo/web", version: "1.2.3" },
  ])
  // In this repository: each of them is said why, and the rest are listed.
  const apps = deployedApps(ROOT).map((one) => one.app)
  for (const app of [
    "api",
    "web",
    "app",
    "expert",
    "team",
    "academy",
    "account",
    "admin",
    "docs",
  ]) {
    assert.ok(apps.includes(app), app)
  }
  for (const app of Object.keys(NOT_DEPLOYED)) {
    assert.ok(!apps.includes(app), app)
    assert.ok(NOT_DEPLOYED[app].length > 10)
  }
})

test("a sound bill of materials has no problem", () => {
  assert.deepEqual(
    sbomProblems(bomOf(["next", "stripe", "@stripe/extra"]), [
      "next",
      "@stripe/extra",
    ]),
    []
  )
  // Tools written the older way, as a list.
  assert.deepEqual(
    sbomProblems(
      bomOf(["next"], {
        specVersion: "1.6",
        metadata: { timestamp: "t", tools: [{ name: "pnpm", version: "11" }] },
      }),
      ["next"]
    ),
    []
  )
})

test("each thing a bill of materials must have is checked", () => {
  const only = (bom, expected = []) => {
    const problems = sbomProblems(bom, expected)
    assert.equal(problems.length, 1, problems.join("\n"))
    return problems[0]
  }
  assert.match(only({ spdxVersion: "SPDX-2.3" }), /not a CycloneDX document/)
  assert.match(only(null), /not a CycloneDX document/)
  assert.match(only(bomOf(["next"], { specVersion: "1.5" })), /older than 1\.6/)
  assert.match(
    only(
      bomOf(["next"], {
        metadata: { tools: { components: [{ name: "pnpm", version: "1" }] } },
      })
    ),
    /no timestamp/
  )
  assert.match(
    only(bomOf(["next"], { metadata: { timestamp: "t" } })),
    /tool that made it/
  )
  assert.match(
    only(bomOf(["next"], { dependencies: [] })),
    /what depends on what/
  )
  assert.match(
    only(
      bomOf(["next"], { components: [{ name: "next", version: "1.0.0" }] }),
      ["next"]
    ),
    /1 component\(s\) lack a name, a version or a package URL \(first: next\)/
  )
  // The reason this script is not one line of pnpm: a file made without
  // the workspace packages lists the app's own dependencies only.
  assert.match(
    only(bomOf(["next"]), ["next", "stripe", "drizzle-orm"]),
    /does not list 2 package\(s\) the app depends on in production: stripe, drizzle-orm$/
  )
  assert.equal(
    sbomProblems(bomOf([]), []).some((one) => /lists no component/.test(one)),
    true
  )
})

test("files are written as the tool wrote them, with a manifest that vouches for them", () => {
  const root = workspace(DEMO)
  const out = path.join(temporary(), "sbom")
  const text = JSON.stringify(
    bomOf(
      [
        "next",
        "stripe",
        "@stripe/extra",
        "drizzle-orm",
        "@neondatabase/serverless",
      ],
      {
        components: [
          { ...component("next"), licenses: [{ license: { id: "MIT" } }] },
          component("stripe"),
          component("@stripe/extra"),
          component("drizzle-orm"),
          component("@neondatabase/serverless"),
          component("left-pad"),
        ],
      }
    )
  )
  const calls = []
  const { manifest, problems } = buildSboms(root, {
    out,
    commit: "abc123",
    run: (_root, name, options) => {
      calls.push([name, options])
      return text
    },
  })
  assert.deepEqual(problems, [])
  assert.deepEqual(calls, [["@demo/web", { lockfileOnly: false }]])
  assert.deepEqual(readdirSync(out).sort(), ["manifest.json", "web.cdx.json"])
  // Byte for byte what the tool wrote.
  assert.equal(readFileSync(path.join(out, "web.cdx.json"), "utf8"), text)

  const written = JSON.parse(
    readFileSync(path.join(out, "manifest.json"), "utf8")
  )
  assert.deepEqual(written, manifest)
  assert.equal(written.commit, "abc123")
  assert.deepEqual(written.limits, LIMITS)
  assert.deepEqual(Object.keys(written.notDeployed), ["poc", "email"])
  const [file] = written.files
  assert.deepEqual(
    { ...file, sha256: file.sha256.length },
    {
      app: "web",
      package: "@demo/web",
      version: "1.2.3",
      file: "web.cdx.json",
      sha256: 64,
      format: "CycloneDX 1.7",
      components: 6,
      withLicence: 1,
    }
  )
})

test("a file that leaves a production dependency out fails, and is still written", () => {
  const root = workspace(DEMO)
  const out = path.join(temporary(), "sbom")
  const { problems } = buildSboms(root, {
    out,
    run: () => JSON.stringify(bomOf(["next"])),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /^web: does not list 5 package\(s\)/)
  assert.ok(readdirSync(out).includes("web.cdx.json"))

  assert.deepEqual(buildSboms(root, { out, run: () => "not json" }).problems, [
    "web: pnpm did not write JSON",
  ])
  assert.throws(
    () => buildSboms(root, { out, apps: ["poc"], run: () => "{}" }),
    /Not a deployed app: poc \(deployed: web\)/
  )
})

test("run as a command on this repository: one app, from the lockfile", () => {
  const out = path.join(temporary(), "sbom")
  const run = spawnSync(
    process.execPath,
    [SCRIPT, "--out", out, "--lockfile-only", "api"],
    { encoding: "utf8", env: { ...process.env, GITHUB_SHA: "0123abc" } }
  )
  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /^api\.cdx\.json: \d+ components, /m)
  const manifest = JSON.parse(
    readFileSync(path.join(out, "manifest.json"), "utf8")
  )
  assert.equal(manifest.commit, "0123abc")
  assert.equal(manifest.lockfileOnly, true)
  assert.equal(manifest.files.length, 1)
  const bom = JSON.parse(readFileSync(path.join(out, "api.cdx.json"), "utf8"))
  const names = new Set(
    bom.components.map((one) =>
      one.group ? `${one.group}/${one.name}` : one.name
    )
  )
  // What the API gets only through workspace packages is there.
  for (const name of ["stripe", "better-auth", "drizzle-orm"]) {
    assert.ok(names.has(name), name)
  }
  // Nothing of ours, and nothing from the reference snapshots.
  assert.ok(![...names].some((name) => name.startsWith("@eleva/")))

  const unknown = spawnSync(process.execPath, [SCRIPT, "--out", out, "poc"], {
    encoding: "utf8",
  })
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /Not a deployed app: poc/)
})
