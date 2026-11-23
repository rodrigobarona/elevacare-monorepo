import { spawnSync } from "node:child_process"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  MIGRATION_EXIT,
  runMigrationCommand,
  type MigrationCommandDeps,
  type MigrationCommandEnv,
} from "./cli"
import type { NeonEndpointInfo } from "./guard"

const PROJECT = "aged-wildflower-123456"
const REHEARSAL_HOST = "ep-rehearsal-a1b2c3d4.eu-central-1.aws.neon.tech"
const PRODUCTION_HOST = "ep-prod-z9y8x7w6.eu-central-1.aws.neon.tech"
const OTHER_PROJECT_HOST = "ep-elsewhere-55556666.eu-central-1.aws.neon.tech"
const MVP_HOST = "ep-mvp-11112222.eu-west-2.aws.neon.tech"
// Passwords and a key no output may ever repeat.
const TARGET_SECRET = "t4rget-Pa55word"
const SOURCE_SECRET = "s0urce-Pa55word"
const API_KEY = "napi_k3y-that-must-not-leak"
const NOW = new Date("2026-11-23T03:30:00.000Z")

const ENDPOINTS: Record<string, NeonEndpointInfo> = {
  [REHEARSAL_HOST]: {
    endpointId: "ep-rehearsal-a1b2c3d4",
    projectId: PROJECT,
    branchId: "br-rehearsal",
    branchName: "rehearsal-2026-11-23",
    isDefaultBranch: false,
    isReadWrite: true,
  },
  [PRODUCTION_HOST]: {
    endpointId: "ep-prod-z9y8x7w6",
    projectId: PROJECT,
    branchId: "br-main",
    branchName: "main",
    isDefaultBranch: true,
    isReadWrite: true,
  },
}

const target = (host: string) =>
  `postgresql://writer:${TARGET_SECRET}@${host}/eleva`
const ENV: MigrationCommandEnv = {
  TARGET_DATABASE_URL: target(REHEARSAL_HOST),
  MVP_DATABASE_URL: `postgresql://reader:${SOURCE_SECRET}@${MVP_HOST}/mvp`,
  NEON_PROJECT_ID: PROJECT,
  NEON_API_KEY: API_KEY,
  MIGRATION_ALLOWED_TARGET_HOSTS: REHEARSAL_HOST,
}
const PRODUCTION_ENV: MigrationCommandEnv = {
  ...ENV,
  TARGET_DATABASE_URL: target(PRODUCTION_HOST),
  MIGRATION_CONFIRM_PRODUCTION: "2026-11-23",
}

function harness(overrides: Partial<MigrationCommandDeps> = {}) {
  const out: string[] = []
  const err: string[] = []
  const resolve = vi.fn(async (host: string) => ENDPOINTS[host] ?? null)
  const createResolver = vi.fn(() => resolve)
  const deps: MigrationCommandDeps = {
    createResolver,
    prompt: vi.fn(async () => PROJECT),
    isInteractive: () => true,
    now: () => NOW,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...overrides,
  }
  return { deps, out, err, resolve, createResolver }
}

/** Everything the command said, to look for what it must never say. */
const said = (h: { out: string[]; err: string[] }) =>
  [...h.out, ...h.err].join("\n")

function expectNoSecrets(h: { out: string[]; err: string[] }) {
  const text = said(h)
  expect(text).not.toContain(TARGET_SECRET)
  expect(text).not.toContain(SOURCE_SECRET)
  expect(text).not.toContain(API_KEY)
  expect(text).not.toMatch(/postgres(ql)?:\/\//)
  expect(text).not.toMatch(/\b(writer|reader)\b/)
}

describe("guard: approved", () => {
  it("exits 0 for a rehearsal, names what was approved, and connects to nothing", async () => {
    const h = harness()
    const code = await runMigrationCommand(["guard"], ENV, h.deps)
    expect(code).toBe(0)
    expect(code).toBe(MIGRATION_EXIT.approved)
    expect(h.err).toEqual([])
    expect(h.out[0]).toBe(
      `approved: target=branch mode=dry-run host=${REHEARSAL_HOST} project=${PROJECT} branch=rehearsal-2026-11-23 (br-rehearsal)`
    )
    expect(h.out[1]).toBe(
      "The guard ran and stopped: no database was connected to."
    )
    // Neon was asked, once built, with the key; about the MVP host and
    // the target host.
    expect(h.createResolver).toHaveBeenCalledTimes(1)
    expect(h.createResolver).toHaveBeenCalledWith({
      apiKey: API_KEY,
      projectId: PROJECT,
    })
    expect(h.resolve.mock.calls.map(([host]) => host)).toEqual([
      MVP_HOST,
      REHEARSAL_HOST,
    ])
    expectNoSecrets(h)
  })

  it("takes the flags a real run takes, and says the mode it approved", async () => {
    const h = harness()
    const code = await runMigrationCommand(
      ["guard", "--apply", "--since", "2026-11-01T00:00:00Z"],
      ENV,
      h.deps
    )
    expect(code).toBe(0)
    expect(h.out[0]).toContain("mode=apply")
  })

  it("approves production only with today's date, a person and the typed id (fakes only)", async () => {
    const h = harness()
    const code = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(code).toBe(0)
    expect(h.out[0]).toContain("target=production")
    expect(h.out[0]).toContain("branch=main (br-main)")
    expect(h.deps.prompt).toHaveBeenCalledTimes(1)
    expectNoSecrets(h)
  })
})

describe("guard: refused", () => {
  it.each([
    [
      "the target URL is missing",
      { ...ENV, TARGET_DATABASE_URL: undefined },
      "TARGET_URL_MISSING",
    ],
    [
      "the host is not on the allow-list",
      { ...ENV, MIGRATION_ALLOWED_TARGET_HOSTS: "" },
      "HOST_NOT_ALLOWED",
    ],
    [
      "a rehearsal names the default branch",
      { ...ENV, TARGET_DATABASE_URL: target(PRODUCTION_HOST) },
      "DEFAULT_BRANCH_IN_BRANCH_MODE",
    ],
    [
      "the endpoint belongs to another project",
      { ...ENV, TARGET_DATABASE_URL: target(OTHER_PROJECT_HOST) },
      "ENDPOINT_NOT_IN_PROJECT",
    ],
    [
      "the source is the target",
      {
        ...ENV,
        MVP_DATABASE_URL: `postgresql://reader:${SOURCE_SECRET}@${REHEARSAL_HOST}/eleva`,
      },
      "SOURCE_IS_TARGET",
    ],
    [
      "the project id is missing",
      { ...ENV, NEON_PROJECT_ID: undefined },
      "NEON_PROJECT_MISSING",
    ],
  ] as const)("exits 2 when %s", async (_name, env, expected) => {
    const h = harness()
    const code = await runMigrationCommand(["guard"], env, h.deps)
    expect(code).toBe(2)
    expect(h.out).toEqual([])
    expect(h.err).toHaveLength(1)
    expect(h.err[0]).toMatch(new RegExp(`^refused ${expected}: `))
    expectNoSecrets(h)
  })

  it("exits 2 when Neon cannot be asked, and says so without the key", async () => {
    const h = harness({
      createResolver: () => async () => {
        throw new Error("Neon API answered 401")
      },
    })
    const code = await runMigrationCommand(["guard"], ENV, h.deps)
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused NEON_LOOKUP_FAILED: /)
    expectNoSecrets(h)
  })

  it("exits 2 without an API key, before any question to Neon is built", async () => {
    for (const NEON_API_KEY of [undefined, "", "   "]) {
      const h = harness()
      const code = await runMigrationCommand(
        ["guard"],
        { ...ENV, NEON_API_KEY },
        h.deps
      )
      expect(code).toBe(2)
      expect(h.err[0]).toMatch(/^refused NEON_API_KEY_MISSING: /)
      expect(h.createResolver).not.toHaveBeenCalled()
      expect(h.resolve).not.toHaveBeenCalled()
    }
  })

  it("exits 2 without a project id, and Neon is never asked", async () => {
    const h = harness()
    await runMigrationCommand(
      ["guard"],
      { ...ENV, NEON_PROJECT_ID: undefined },
      h.deps
    )
    expect(h.createResolver).not.toHaveBeenCalled()
  })

  it("refuses production without today's date, without a person, or with the wrong id", async () => {
    const cases = [
      [
        { ...PRODUCTION_ENV, MIGRATION_CONFIRM_PRODUCTION: undefined },
        {},
        "PRODUCTION_NOT_CONFIRMED",
      ],
      [
        { ...PRODUCTION_ENV, MIGRATION_CONFIRM_PRODUCTION: "2026-11-22" },
        {},
        "PRODUCTION_NOT_CONFIRMED",
      ],
      [
        PRODUCTION_ENV,
        { isInteractive: () => false },
        "PRODUCTION_NOT_INTERACTIVE",
      ],
      [
        PRODUCTION_ENV,
        { prompt: async () => "some-other-project" },
        "PROJECT_ID_NOT_TYPED",
      ],
    ] as const
    for (const [env, overrides, expected] of cases) {
      const h = harness(overrides)
      const code = await runMigrationCommand(
        ["guard", "--target", "production"],
        env,
        h.deps
      )
      expect(code, expected).toBe(2)
      expect(h.err[0]).toMatch(new RegExp(`^refused ${expected}: `))
      expect(h.out).toEqual([])
      expectNoSecrets(h)
    }
  })

  it("a dry run against production asks for the same confirmation", async () => {
    const h = harness({ isInteractive: () => false })
    const code = await runMigrationCommand(
      ["guard", "--target", "production", "--dry-run"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused PRODUCTION_NOT_INTERACTIVE: /)
  })
})

describe("guard: usage", () => {
  it.each([
    [[], /name a command: guard/],
    [["migrate"], /unknown command "migrate"/],
    [["--apply"], /unknown command "--apply"/],
    [["guard", "--frobnicate"], /unknown argument "--frobnicate"/],
    [["guard", "--dry-run", "--apply"], /choose one of --dry-run and --apply/],
    [["guard", "--target", "staging"], /--target must be/],
    [["guard", "--since", "yesterday"], /--since must be/],
  ] as const)(
    "exits 2 for %j, and Neon is never asked",
    async (argv, message) => {
      const h = harness()
      const code = await runMigrationCommand(argv, ENV, h.deps)
      expect(code).toBe(2)
      expect(h.err[0]).toMatch(/^refused USAGE: /)
      expect(h.err[0]).toMatch(message)
      expect(h.out).toEqual([])
      expect(h.createResolver).not.toHaveBeenCalled()
    }
  )
})

describe("guard: something unexpected", () => {
  it("exits 1, never 0 and never 2, and repeats nothing it was not given to say", async () => {
    const h = harness({
      now: () => {
        throw new TypeError(
          `cannot read clock for ${ENV.TARGET_DATABASE_URL} with ${API_KEY}`
        )
      },
    })
    const code = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(code).toBe(1)
    expect(code).toBe(MIGRATION_EXIT.unexpected)
    expect(h.out).toEqual([])
    expect(h.err).toEqual([
      "failed: unexpected TypeError. No database was connected to.",
    ])
    expectNoSecrets(h)
  })

  it("exits 1 when what was thrown is not even an error", async () => {
    const h = harness({
      prompt: async () => {
        throw "a string"
      },
    })
    const code = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(code).toBe(1)
    expect(h.err).toEqual([
      "failed: unexpected error. No database was connected to.",
    ])
  })
})

describe("the real process", () => {
  const PACKAGE = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    ".."
  )
  /** The package's own script, with an environment that holds nothing. */
  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx/esm", "src/main.ts", ...args],
      {
        cwd: PACKAGE,
        env: { PATH: process.env.PATH ?? "", ...env },
        encoding: "utf8",
        // No terminal: stdin is closed, so a prompt could only hang.
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
      }
    )

  it("exits 2 with nothing set, names the refusal, and makes no network call", () => {
    const result = run(["guard"])
    expect(result.status).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr).toMatch(/^refused TARGET_URL_MISSING: /)
  }, 90_000)

  it("exits 2 on a usage error", () => {
    const result = run(["guard", "--frobnicate"])
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/^refused USAGE: unknown argument/)
  }, 90_000)

  it("refuses production from a process with no terminal, and does not hang", () => {
    // The checks before the terminal need Neon, which this test never
    // reaches: without a key the run stops there. What matters is that it
    // ends, with 2, and a .env file next to the package is not read.
    const result = run(["guard", "--target", "production"], {
      TARGET_DATABASE_URL: target(PRODUCTION_HOST),
      MVP_DATABASE_URL: `postgresql://reader:${SOURCE_SECRET}@${MVP_HOST}/mvp`,
      NEON_PROJECT_ID: PROJECT,
      MIGRATION_CONFIRM_PRODUCTION: "2026-11-23",
    })
    expect(result.status).toBe(2)
    expect(result.signal).toBeNull()
    expect(result.stderr).toMatch(/^refused NEON_API_KEY_MISSING: /)
    expect(result.stdout + result.stderr).not.toContain(TARGET_SECRET)
    expect(result.stdout + result.stderr).not.toContain(SOURCE_SECRET)
  }, 90_000)
})
