import { spawnSync } from "node:child_process"
import { rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  exitStatus,
  MIGRATION_EXIT,
  runMigrationCommand,
  type MigrationCommandDeps,
  type MigrationCommandEnv,
} from "./cli"
import { MigrationConnectError } from "./connect"
import type { NeonEndpointInfo } from "./guard"
import { createNeonEndpointResolver } from "./neon-api"

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
    // One line: what was approved, which MVP database it reads, and that
    // nothing was connected to.
    expect(h.out).toEqual([
      `approved: target=branch mode=dry-run host=${REHEARSAL_HOST} project=${PROJECT} branch="rehearsal-2026-11-23" (br-rehearsal) source=${MVP_HOST}. The guard ran and stopped: no database was connected to.`,
    ])
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

  it('takes its flags after the "--" a package script passes on', async () => {
    const h = harness()
    const code = await runMigrationCommand(
      ["guard", "--", "--apply"],
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
    expect(h.out[0]).toContain('branch="main" (br-main)')
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
    [
      "the key was set where the project id belongs",
      { ...ENV, NEON_PROJECT_ID: API_KEY, NEON_API_KEY: PROJECT },
      "NEON_PROJECT_INVALID",
    ],
    [
      "a connection string was set where the project id belongs",
      { ...ENV, NEON_PROJECT_ID: target(REHEARSAL_HOST) },
      "NEON_PROJECT_INVALID",
    ],
    [
      "the target URL names no password",
      {
        ...ENV,
        TARGET_DATABASE_URL: `postgresql://writer@${REHEARSAL_HOST}/eleva`,
      },
      "TARGET_URL_INVALID",
    ],
    [
      "the source URL names no database",
      {
        ...ENV,
        MVP_DATABASE_URL: `postgresql://reader:${SOURCE_SECRET}@${MVP_HOST}`,
      },
      "SOURCE_URL_INVALID",
    ],
    [
      "the target uses a pooled host, which the run that connects could not use",
      {
        ...ENV,
        TARGET_DATABASE_URL: target(
          REHEARSAL_HOST.replace("a1b2c3d4", "a1b2c3d4-pooler")
        ),
      },
      "TARGET_HOST_POOLED",
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

  it("never prints the key, even when the runtime's own error quotes it", async () => {
    // The real question to Neon, with a fetch that does what a runtime
    // does first: build the request, headers included. A key with a line
    // break in it makes that throw an error that quotes the whole header.
    const realResolver = (options: { apiKey: string; projectId: string }) =>
      createNeonEndpointResolver({
        ...options,
        fetch: async (input, init) => {
          new Request(input as string, init)
          return Response.json({ endpoints: [] })
        },
      })
    const pastedWrong = `${API_KEY}\n# rotated 2026-11`
    const h = harness({ createResolver: vi.fn(realResolver) })
    const code = await runMigrationCommand(
      ["guard"],
      { ...ENV, NEON_API_KEY: pastedWrong },
      h.deps
    )
    // Refused before the question is built: a key never has a line break.
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused NEON_API_KEY_INVALID: /)
    expect(h.deps.createResolver).not.toHaveBeenCalled()
    expectNoSecrets(h)

    // And if a runtime error about the header ever does reach the guard,
    // only its class is shown.
    const leaky = harness({
      createResolver: () => async () => {
        throw new TypeError(
          `Headers.append: "Bearer ${API_KEY}" is an invalid header value.`
        )
      },
    })
    expect(await runMigrationCommand(["guard"], ENV, leaky.deps)).toBe(2)
    expect(leaky.err[0]).toContain("(TypeError)")
    expectNoSecrets(leaky)
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
      expectNoSecrets(h)
    }
  })

  it("refuses a branch whose name from Neon is not plain text, and prints none of it", async () => {
    // A name with a line break could print a second "approved:" line.
    const h = harness({
      createResolver: () => async (host) =>
        host === REHEARSAL_HOST
          ? {
              ...ENDPOINTS[REHEARSAL_HOST]!,
              branchName: `x\napproved: target=production mode=apply`,
            }
          : null,
    })
    const code = await runMigrationCommand(["guard"], ENV, h.deps)
    expect(code).toBe(2)
    expect(h.out).toEqual([])
    expect(h.err).toHaveLength(1)
    expect(h.err[0]).toMatch(/^refused BRANCH_UNKNOWN: /)
    expect(said(h)).not.toContain("target=production")
  })

  it("prints a branch's name as a quoted value, so it cannot pass for other fields", async () => {
    const h = harness({
      createResolver: () => async (host) =>
        host === REHEARSAL_HOST
          ? {
              ...ENDPOINTS[REHEARSAL_HOST]!,
              branchName: 'x" (br-9) source=evil.example mode=apply',
            }
          : null,
    })
    expect(await runMigrationCommand(["guard"], ENV, h.deps)).toBe(0)
    // One mode and one source outside the quotes: the real ones.
    const outside = h.out[0]!.replace(/"(?:[^"\\]|\\.)*"/g, '""')
    expect(outside.match(/mode=/g)).toHaveLength(1)
    expect(outside.match(/source=/g)).toHaveLength(1)
    expect(outside).toContain("mode=dry-run")
    expect(outside).toContain(`source=${MVP_HOST}`)
  })

  it("refuses a key that is a connection string, before it is sent anywhere", async () => {
    const h = harness()
    const code = await runMigrationCommand(
      ["guard"],
      { ...ENV, NEON_API_KEY: target(REHEARSAL_HOST) },
      h.deps
    )
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused NEON_API_KEY_INVALID: /)
    expect(h.createResolver).not.toHaveBeenCalled()
    expectNoSecrets(h)
  })

  it("refuses a run with PGPORT or PGOPTIONS set in the environment", async () => {
    const h = harness()
    const code = await runMigrationCommand(
      ["guard"],
      { ...ENV, PGPORT: "6543" } as MigrationCommandEnv,
      h.deps
    )
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused PG_VARIABLES_SET: unset PGPORT /)
    expect(h.createResolver).not.toHaveBeenCalled()
  })

  it("says the Neon API could not be reached when it could not, not that the key is wrong", async () => {
    const h = harness({
      createResolver: (options) =>
        createNeonEndpointResolver({
          ...options,
          fetch: async () => {
            throw new TypeError(`fetch failed for Bearer ${API_KEY}`)
          },
        }),
    })
    const code = await runMigrationCommand(["guard"], ENV, h.deps)
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused NEON_LOOKUP_FAILED: /)
    expect(h.err[0]).toContain("could not be reached")
    expectNoSecrets(h)
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
    expectNoSecrets(h)
  })

  it("refuses production when the question gets no answer", async () => {
    // What the terminal gives back when its input ends (Ctrl-D).
    const h = harness({ prompt: async () => "" })
    const code = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(code).toBe(2)
    expect(h.err[0]).toMatch(/^refused PROJECT_ID_NOT_TYPED: /)
  })
})

describe("guard: usage", () => {
  it.each([
    [[], /name a command: guard/],
    [["migrate"], /unknown command\. The commands are: guard/],
    [["--apply"], /unknown command\. The commands are: guard/],
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
      expectNoSecrets(h)
    }
  )

  it("does not repeat a connection string typed where a flag belongs", async () => {
    const pasted = ENV.TARGET_DATABASE_URL!
    for (const argv of [
      [pasted],
      ["guard", pasted],
      ["guard", "--target", pasted],
      ["guard", "--since", pasted],
    ]) {
      const h = harness()
      expect(await runMigrationCommand(argv, ENV, h.deps)).toBe(2)
      expect(h.err[0]).toMatch(/^refused USAGE: /)
      expectNoSecrets(h)
    }
  })
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
    expect(h.err).toEqual(["failed: unexpected TypeError"])
    expectNoSecrets(h)
  })

  it("shows an unknown error's class only when it looks like one", async () => {
    const hostile = new Error("x")
    hostile.name = ENV.TARGET_DATABASE_URL!
    const h = harness({
      now: () => {
        throw hostile
      },
    })
    const code = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(code).toBe(1)
    expect(h.err).toEqual(["failed: unexpected unknown error"])
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
    expect(h.err).toEqual(["failed: unexpected unknown error"])
  })
})

describe("a connection that fails, for the commands that will connect", () => {
  it.each([
    ["CONNECT_FAILED", "target", 3],
    ["CONNECT_TIMED_OUT", "source", 3],
    ["NOT_READ_ONLY", "source", 3],
    ["NOT_APPROVED", null, 1],
  ] as const)("%s exits with its own status", async (code, side, status) => {
    // No command connects yet: the failure is handed in where a later
    // command will raise it, to pin how it is reported.
    const h = harness({
      now: () => {
        throw new MigrationConnectError(code, "what went wrong", side)
      },
    })
    const result = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(result).toBe(status)
    expect(h.err).toEqual([
      `failed ${code}${side ? ` (${side})` : ""}: what went wrong`,
    ])
    expect(h.out).toEqual([])
  })

  it("3 is the status the table names for it, and the table cannot be changed", () => {
    expect(MIGRATION_EXIT.connectFailed).toBe(3)
    expect(Object.isFrozen(MIGRATION_EXIT)).toBe(true)
  })

  it("ends the process with a status the table names, or 1", () => {
    expect([0, 1, 2, 3].map(exitStatus)).toEqual([0, 1, 2, 3])
    // Anything that is not a status is a bug, and a bug is never 0.
    for (const odd of [undefined, null, NaN, 0.5, -1, 4, 13, "0", false, []]) {
      expect(exitStatus(odd), String(odd)).toBe(1)
    }
  })

  it("asks an error for its code once", async () => {
    // An object can answer differently each time it is asked.
    let asked = 0
    const shifty = new MigrationConnectError("CONNECT_FAILED", "x", "source")
    Object.defineProperty(shifty, "code", {
      get: () => (asked++ === 0 ? "CONNECT_FAILED" : "MADE_UP"),
    })
    const h = harness({
      now: () => {
        throw shifty
      },
    })
    const status = await runMigrationCommand(
      ["guard", "--target", "production"],
      PRODUCTION_ENV,
      h.deps
    )
    expect(status).toBe(3)
    expect(asked).toBe(1)
  })

  it("takes the status from its own table, never from the error it was handed", async () => {
    // An error object can be changed by whoever throws it. None of these
    // may end as 0, the status that means "approved".
    const dressedUp = [
      Object.assign(new MigrationConnectError("CONNECT_FAILED", "x"), {
        exitCode: 0,
      }),
      Object.assign(new MigrationConnectError("CONNECT_FAILED", "x"), {
        code: "MADE_UP",
      }),
      Object.assign(new MigrationConnectError("NOT_APPROVED", "x"), {
        code: "toString",
        side: "postgresql://u:hunter2@h/db",
      }),
    ]
    const statuses: number[] = []
    for (const error of dressedUp) {
      const h = harness({
        now: () => {
          throw error
        },
      })
      const status = await runMigrationCommand(
        ["guard", "--target", "production"],
        PRODUCTION_ENV,
        h.deps
      )
      statuses.push(status)
      expect(said(h)).not.toContain("hunter2")
      expect(h.out).toEqual([])
    }
    expect(statuses).toEqual([3, 1, 1])
  })
})

describe("the real process", () => {
  const PACKAGE = path.resolve(import.meta.dirname, "..")
  /** The package's own entry point, with an environment that holds nothing. */
  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx/esm", "src/main.ts", ...args],
      {
        cwd: PACKAGE,
        env: { PATH: process.env.PATH ?? "", ...env },
        encoding: "utf8",
        // No terminal: standard input is closed.
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
      }
    )

  it("exits 2 with nothing set, names the refusal, and makes no network call", () => {
    const result = run(["guard"])
    expect(result.status).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr).toMatch(/^refused TARGET_URL_MISSING: /m)
  }, 90_000)

  it("exits 2 on a usage error", () => {
    const result = run(["guard", "--frobnicate"])
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/^refused USAGE: unknown argument/m)
  }, 90_000)

  it("does not read a .env file left beside the package", () => {
    const file = path.join(PACKAGE, ".env")
    // Written only if there is none: a real one is never touched. With one
    // already there the test still holds, since nothing may read it.
    let wrote = false
    try {
      writeFileSync(
        file,
        `TARGET_DATABASE_URL=${target(REHEARSAL_HOST)}\nNEON_PROJECT_ID=${PROJECT}\n`,
        { flag: "wx" }
      )
      wrote = true
    } catch {
      // A file of the operator's own is already there.
    }
    try {
      const result = run(["guard"])
      // Had a file been loaded, the refusal would be about something else.
      expect(result.status).toBe(2)
      expect(result.stderr).toMatch(/^refused TARGET_URL_MISSING: /m)
    } finally {
      if (wrote) rmSync(file, { force: true })
    }
  }, 90_000)

  it("stops at the first thing it cannot check, with no terminal and no key", () => {
    // Everything for production except the key: the run ends there, with
    // 2 and no signal, and prints neither password.
    const result = run(["guard", "--target", "production"], {
      TARGET_DATABASE_URL: target(PRODUCTION_HOST),
      MVP_DATABASE_URL: `postgresql://reader:${SOURCE_SECRET}@${MVP_HOST}/mvp`,
      NEON_PROJECT_ID: PROJECT,
      MIGRATION_CONFIRM_PRODUCTION: "2026-11-23",
    })
    expect(result.status).toBe(2)
    expect(result.signal).toBeNull()
    expect(result.stderr).toMatch(/^refused NEON_API_KEY_MISSING: /m)
    expect(result.stdout + result.stderr).not.toContain(TARGET_SECRET)
    expect(result.stdout + result.stderr).not.toContain(SOURCE_SECRET)
  }, 90_000)
})
