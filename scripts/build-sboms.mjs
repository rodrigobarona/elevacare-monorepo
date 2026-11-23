#!/usr/bin/env node
/**
 * Writes a software bill of materials for each app that is deployed.
 *
 * One CycloneDX file per app, made by `pnpm sbom` from the lockfile and
 * left as pnpm wrote it, plus `manifest.json`, which says for each file
 * which app and commit it is for and gives its SHA-256.
 *
 * What a file lists: every package the app depends on in production, its
 * own and those it gets through the `@eleva/*` workspace packages it
 * uses, with name, version, package URL, the registry tarball's SHA-512
 * and, when the packages are installed, the licence.
 *
 * What it is not (the same list is in the manifest, for whoever is sent
 * the files):
 * - It is the set the lockfile resolves, not what the host traced into a
 *   deployment. It is larger: binaries for every platform, and some
 *   packages that are only peers of others.
 * - It is made here, from the commit, not by the build that deploys. It
 *   matches a deployment because that build installs the same commit
 *   with the same frozen lockfile.
 * - It does not list the Node.js runtime, the build image, hosted
 *   services, or our own `@eleva/*` packages (they are in this
 *   repository at the same commit).
 * - The root component of each file names the workspace, not the app:
 *   the file's name and the manifest say which app.
 *
 * Usage: node scripts/build-sboms.mjs [--out <dir>] [--lockfile-only]
 *        [app ...]
 * `--lockfile-only` skips the installed packages: faster, no licences.
 */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** Apps that are not deployed as a product, and why. */
export const NOT_DEPLOYED = {
  poc: "the internal design playground",
  email: "the email preview tool, run on a developer's machine",
}

/** The oldest CycloneDX version accepted (BSI TR-03183-2 asks for 1.6). */
const OLDEST_SPEC = [1, 6]

export const LIMITS = [
  "Lists what the lockfile resolves for the app, not what the host traced into a deployment: it is larger (binaries for every platform, some packages that are only peers of others).",
  "Made in CI from the commit, not by the build that deploys. It matches a deployment because that build installs the same commit with the same frozen lockfile.",
  "Does not list the Node.js runtime, the build image, hosted services, or the first-party @eleva/* packages (they are in the repository at the same commit).",
  "The root component of each file names the workspace, not the app: the file name and this manifest say which app.",
  "Licences are present only for packages that were installed when the file was made; supplier is not filled.",
  "Each component's hash is the SHA-512 of its registry tarball, under externalReferences (type: distribution), not under the component's own hashes.",
  "Checked here: the format and its version, a timestamp, the tool, a name, version and package URL for every component, and that every package the app names as a production dependency is listed. Not checked: the file against the CycloneDX schema, or packages reached only through other packages (that is trusted to pnpm).",
]

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))

/** Every workspace package, by name: its folder and its package.json. */
export function workspacePackages(root) {
  const packages = new Map()
  for (const group of ["apps", "packages", "infra"]) {
    const dir = path.join(root, group)
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name, "package.json")
      if (!entry.isDirectory() || !existsSync(file)) continue
      const manifest = readJson(file)
      if (manifest.name) {
        packages.set(manifest.name, {
          dir: `${group}/${entry.name}`,
          manifest,
        })
      }
    }
  }
  return packages
}

/** The deployed apps: every folder of `apps/` with a package, less those above. */
export function deployedApps(root) {
  return [...workspacePackages(root).entries()]
    .filter(([, one]) => one.dir.startsWith("apps/"))
    .map(([name, one]) => ({
      app: one.dir.slice("apps/".length),
      name,
      version: one.manifest.version ?? "0.0.0",
    }))
    .filter(({ app }) => !Object.hasOwn(NOT_DEPLOYED, app))
    .sort((a, b) => a.app.localeCompare(b.app))
}

/**
 * What an app depends on in production, by name, from the package files:
 * its own dependencies, and those of every workspace package it reaches.
 * This is what the bill must at the very least contain.
 */
export function productionDependencies(root, name) {
  const packages = workspacePackages(root)
  const external = new Set()
  const seen = new Set()
  const visit = (workspaceName) => {
    if (seen.has(workspaceName)) return
    seen.add(workspaceName)
    const { manifest } = packages.get(workspaceName)
    for (const [dependency, range] of Object.entries({
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
    })) {
      if (packages.has(dependency) && String(range).startsWith("workspace:")) {
        visit(dependency)
      } else if (String(range).startsWith("npm:")) {
        // An alias installs another package under this name, with or
        // without a version after it.
        external.add(String(range).match(/^npm:(@?[^@]+)/)[1])
      } else if (String(range).startsWith("workspace:")) {
        throw new Error(
          `${workspaceName} depends on ${dependency} as a workspace package, and there is none of that name`
        )
      } else {
        external.add(dependency)
      }
    }
  }
  if (!packages.has(name)) throw new Error(`${name} is not a workspace package`)
  visit(name)
  return [...external].sort()
}

/** What is wrong with a bill of materials for an app. Empty when it is sound. */
export function sbomProblems(bom, expected) {
  const problems = []
  if (bom?.bomFormat !== "CycloneDX") {
    return [`is not a CycloneDX document (bomFormat: ${bom?.bomFormat})`]
  }
  const [major, minor] = String(bom.specVersion).split(".").map(Number)
  if (
    !(
      major > OLDEST_SPEC[0] ||
      (major === OLDEST_SPEC[0] && minor >= OLDEST_SPEC[1])
    )
  ) {
    problems.push(`is CycloneDX ${bom.specVersion}, older than 1.6`)
  }
  if (!bom.metadata?.timestamp) problems.push("has no timestamp")
  const tools = bom.metadata?.tools?.components ?? bom.metadata?.tools ?? []
  if (!tools.some((tool) => tool.name && tool.version)) {
    problems.push("does not name the tool that made it, with its version")
  }
  const components = bom.components ?? []
  if (components.length === 0) problems.push("lists no component")
  const incomplete = components.filter(
    (component) => !component.name || !component.version || !component.purl
  )
  if (incomplete.length > 0) {
    problems.push(
      `${incomplete.length} component(s) lack a name, a version or a package URL (first: ${incomplete[0].name ?? "unnamed"})`
    )
  }
  if (!Array.isArray(bom.dependencies) || bom.dependencies.length === 0) {
    problems.push("says nothing of what depends on what")
  }
  const listed = new Set(
    components.map((component) =>
      component.group ? `${component.group}/${component.name}` : component.name
    )
  )
  const missing = expected.filter((name) => !listed.has(name))
  if (missing.length > 0) {
    problems.push(
      `does not list ${missing.length} package(s) the app depends on in production: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ", ..." : ""}`
    )
  }
  return problems
}

/** `pnpm sbom` for one app and everything it reaches in the workspace. */
function runPnpmSbom(root, name, { lockfileOnly }) {
  return execFileSync(
    "pnpm",
    [
      // With the three dots: the app and the workspace packages it uses.
      // Without them pnpm 11.1 lists the app's own dependencies only.
      "--filter-prod",
      `${name}...`,
      "sbom",
      "--prod",
      "--sbom-format",
      "cyclonedx",
      "--sbom-type",
      "application",
      ...(lockfileOnly ? ["--lockfile-only"] : []),
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  )
}

/**
 * Makes the files. Returns the manifest and, for each app that could not
 * be vouched for, what is wrong.
 */
export function buildSboms(
  root,
  { out, lockfileOnly = false, apps, run = runPnpmSbom, commit } = {}
) {
  const all = deployedApps(root)
  const unknown = (apps ?? []).filter(
    (app) => !all.some((one) => one.app === app)
  )
  if (unknown.length > 0) {
    throw new Error(
      `Not a deployed app: ${unknown.join(", ")} (deployed: ${all.map((one) => one.app).join(", ")})`
    )
  }
  const chosen = apps?.length
    ? all.filter((one) => apps.includes(one.app))
    : all
  mkdirSync(out, { recursive: true })
  // What an earlier run wrote here goes first: a run of some apps, or one
  // that fails for an app, must not leave an older bill beside a manifest
  // that does not name it. Only the files this script writes.
  for (const file of readdirSync(out)) {
    if (file === "manifest.json" || file.endsWith(".cdx.json")) {
      rmSync(path.join(out, file))
    }
  }

  const problems = []
  const files = []
  for (const { app, name, version } of chosen) {
    const text = run(root, name, { lockfileOnly })
    let bom
    try {
      bom = JSON.parse(text)
    } catch {
      problems.push(`${app}: pnpm did not write JSON`)
      continue
    }
    const found = sbomProblems(bom, productionDependencies(root, name))
    problems.push(...found.map((problem) => `${app}: ${problem}`))
    const file = `${app}.cdx.json`
    writeFileSync(path.join(out, file), text)
    files.push({
      app,
      package: name,
      version,
      file,
      sha256: createHash("sha256").update(text).digest("hex"),
      format: `CycloneDX ${bom.specVersion}`,
      components: bom.components?.length ?? 0,
      withLicence: (bom.components ?? []).filter(
        (component) => component.licenses?.length
      ).length,
    })
  }

  const manifest = {
    commit: commit ?? null,
    generatedAt: new Date().toISOString(),
    generatedBy: "pnpm sbom (scripts/build-sboms.mjs)",
    scope:
      "production dependencies of each deployed app, with those of the workspace packages it uses",
    lockfileOnly,
    notDeployed: NOT_DEPLOYED,
    limits: LIMITS,
    files,
  }
  writeFileSync(
    path.join(out, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  return { manifest, problems }
}

function main() {
  const root = path.resolve(import.meta.dirname, "..")
  const args = process.argv.slice(2)
  const take = (flag) => {
    const index = args.indexOf(flag)
    if (index === -1) return undefined
    const [, value] = args.splice(index, 2)
    return value
  }
  const out = path.resolve(root, take("--out") ?? "sbom")
  const lockfileOnly = args.includes("--lockfile-only")
  const apps = args.filter((arg) => !arg.startsWith("--"))

  let result
  try {
    result = buildSboms(root, {
      out,
      lockfileOnly,
      apps,
      commit: process.env.GITHUB_SHA ?? null,
    })
  } catch (error) {
    console.error(
      `Bill of materials failed. ${error instanceof Error ? error.message.split("\n")[0] : error}`
    )
    process.exit(1)
  }
  for (const file of result.manifest.files) {
    console.log(
      `${file.file}: ${file.components} components, ${file.withLicence} with a licence (${file.package})`
    )
  }
  if (result.problems.length > 0) {
    console.error("\nBill of materials failed:\n")
    for (const problem of result.problems) console.error(`- ${problem}`)
    process.exit(1)
  }
  console.log(
    `\nWrote ${result.manifest.files.length} files and manifest.json to ${path.relative(root, out) || "."}.`
  )
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main()
}
