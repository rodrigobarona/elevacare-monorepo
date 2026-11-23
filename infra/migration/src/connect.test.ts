import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  MIGRATION_CONNECT_EXIT,
  MigrationConnectError,
  openMigrationConnections,
  type MigrationSession,
  type OpenMigrationSession,
} from "./connect"
import {
  assertMigrationTarget,
  isApprovedMigrationTarget,
  type ApprovedMigrationTarget,
  type MigrationGuardEnv,
  type NeonEndpointInfo,
} from "./guard"

const PROJECT = "aged-wildflower-123456"
const TARGET_HOST = "ep-rehearsal-a1b2c3d4.eu-central-1.aws.neon.tech"
const SOURCE_HOST = "ep-mvp-11112222.eu-west-2.aws.neon.tech"
// A password no message may ever repeat.
const SECRET = "s3cr3t-Pa55word"
const ENV: MigrationGuardEnv = {
  TARGET_DATABASE_URL: `postgresql://writer:${SECRET}@${TARGET_HOST}/eleva`,
  MVP_DATABASE_URL: `postgresql://reader:${SECRET}@${SOURCE_HOST}/mvp`,
  NEON_PROJECT_ID: PROJECT,
  MIGRATION_ALLOWED_TARGET_HOSTS: TARGET_HOST,
}
const REHEARSAL: NeonEndpointInfo = {
  endpointId: "ep-rehearsal-a1b2c3d4",
  projectId: PROJECT,
  branchId: "br-rehearsal",
  branchName: "rehearsal-2026-11-23",
  isDefaultBranch: false,
  isReadWrite: true,
}

/** A target the real guard approved, with a fake answer from Neon. */
async function approve(
  mode: "dry-run" | "apply" = "dry-run",
  env: MigrationGuardEnv = ENV
): Promise<ApprovedMigrationTarget> {
  return assertMigrationTarget(
    { target: "branch", mode, env },
    {
      resolveEndpoint: async (host) =>
        host === TARGET_HOST ? REHEARSAL : null,
      prompt: async () => PROJECT,
      isInteractive: () => false,
      now: () => new Date("2026-11-23T10:00:00.000Z"),
    }
  )
}

/** A driver that keeps what it was asked, and can be told to misbehave. */
function fakeDriver(
  options: {
    failOn?: string
    /** A code on the error, as a real driver sets (`28P01`, `ENOTFOUND`). */
    failCode?: string
    /** What the server says the session's setting is after `SET`. */
    readOnlyAnswer?: string
    failSetOn?: string
    /** Opens only after this many milliseconds. */
    slowOn?: { host: string; ms: number }
  } = {}
) {
  const opened: { url: string; readOnly: boolean }[] = []
  const sessions = new Map<
    string,
    { queries: string[]; ended: number; session: MigrationSession }
  >()
  const open: OpenMigrationSession = vi.fn(async (url, { readOnly }) => {
    opened.push({ url, readOnly })
    if (options.slowOn && url.includes(options.slowOn.host)) {
      await new Promise((resolve) => setTimeout(resolve, options.slowOn!.ms))
    }
    if (options.failOn && url.includes(options.failOn)) {
      // What a real driver does: the address, password included, in the text.
      throw Object.assign(new Error(`connect ECONNREFUSED ${url}`), {
        code: options.failCode,
      })
    }
    const record = {
      queries: [] as string[],
      ended: 0,
      session: undefined as unknown as MigrationSession,
    }
    record.session = {
      query: async (text: string) => {
        record.queries.push(text)
        if (
          text.startsWith("SET") &&
          options.failSetOn &&
          url.includes(options.failSetOn)
        ) {
          throw new Error(`permission denied on ${url}`)
        }
        return text.startsWith("SHOW")
          ? {
              rows: [
                {
                  default_transaction_read_only: options.readOnlyAnswer ?? "on",
                },
              ],
            }
          : { rows: [] }
      },
      end: async () => {
        record.ended += 1
      },
    }
    sessions.set(url, record)
    return record.session
  })
  return { open, opened, sessions }
}

const READ_ONLY = [
  "SET default_transaction_read_only = on",
  "SHOW default_transaction_read_only",
]

describe("an approval", () => {
  it("is something only the guard gives, and cannot be changed afterwards", async () => {
    const approved = await approve()
    expect(isApprovedMigrationTarget(approved)).toBe(true)
    expect(Object.isFrozen(approved)).toBe(true)
    // Logged or written into a report, it carries no password.
    expect(JSON.stringify(approved)).not.toContain(SECRET)
    expect(JSON.stringify({ approved })).not.toContain("postgresql://")
    expect(approved.targetUrl).toContain(SECRET)
    // A copy has every field and is not the approval.
    expect(isApprovedMigrationTarget({ ...approved })).toBe(false)
    expect(isApprovedMigrationTarget(structuredClone(approved))).toBe(false)
    expect(isApprovedMigrationTarget(null)).toBe(false)
    expect(isApprovedMigrationTarget("approved")).toBe(false)
    expect(() => {
      ;(approved as { targetUrl: string }).targetUrl =
        "postgresql://x:y@evil.example/db"
    }).toThrow(TypeError)
  })
})

describe("openMigrationConnections", () => {
  it("refuses a target the guard did not issue, before anything is opened", async () => {
    const approved = await approve()
    const driver = fakeDriver()
    for (const forged of [
      { ...approved },
      {
        ...approved,
        targetUrl: `postgresql://writer:${SECRET}@ep-prod.eu-central-1.aws.neon.tech/eleva`,
      },
      JSON.parse(JSON.stringify(approved)) as ApprovedMigrationTarget,
    ]) {
      await expect(
        openMigrationConnections(forged, driver)
      ).rejects.toMatchObject({ code: "NOT_APPROVED" })
    }
    // Things that pass for the object without being it.
    for (const lookalike of [
      Object.create(approved) as ApprovedMigrationTarget,
      new Proxy(approved, {}),
    ]) {
      await expect(
        openMigrationConnections(lookalike, driver)
      ).rejects.toMatchObject({ code: "NOT_APPROVED" })
    }
    expect(driver.open).not.toHaveBeenCalled()
  })

  it("opens for an approved production target too (fakes only)", async () => {
    const PRODUCTION_HOST = "ep-prod-z9y8x7w6.eu-central-1.aws.neon.tech"
    const approved = await assertMigrationTarget(
      {
        target: "production",
        mode: "apply",
        env: {
          ...ENV,
          TARGET_DATABASE_URL: `postgresql://writer:${SECRET}@${PRODUCTION_HOST}/eleva`,
          MIGRATION_CONFIRM_PRODUCTION: "2026-11-23",
        },
      },
      {
        resolveEndpoint: async (host) =>
          host === PRODUCTION_HOST
            ? {
                ...REHEARSAL,
                branchId: "br-main",
                branchName: "main",
                isDefaultBranch: true,
              }
            : null,
        prompt: async () => PROJECT,
        isInteractive: () => true,
        now: () => new Date("2026-11-23T10:00:00.000Z"),
      }
    )
    const driver = fakeDriver()
    const connections = await openMigrationConnections(approved, driver)
    expect(connections.targetIsWritable).toBe(true)
    await connections.close()
  })

  it("connects with the two strings the guard rebuilt, whatever the environment says later", async () => {
    const env = { ...ENV }
    const approved = await approve("dry-run", env)
    // The environment changes after approval: it is not read again.
    env.TARGET_DATABASE_URL = `postgresql://writer:${SECRET}@ep-other.eu-central-1.aws.neon.tech/eleva`
    env.MVP_DATABASE_URL = `postgresql://reader:${SECRET}@ep-other-mvp.eu-west-2.aws.neon.tech/mvp`
    const before = { ...process.env }
    process.env.TARGET_DATABASE_URL = env.TARGET_DATABASE_URL
    process.env.MVP_DATABASE_URL = env.MVP_DATABASE_URL
    try {
      const driver = fakeDriver()
      const connections = await openMigrationConnections(approved, driver)
      expect(driver.opened.map((entry) => entry.url)).toEqual([
        approved.sourceUrl,
        approved.targetUrl,
      ])
      expect(driver.opened[0]!.url).toContain(SOURCE_HOST)
      expect(driver.opened[1]!.url).toContain(TARGET_HOST)
      await connections.close()
    } finally {
      process.env.TARGET_DATABASE_URL = before.TARGET_DATABASE_URL
      process.env.MVP_DATABASE_URL = before.MVP_DATABASE_URL
      if (before.TARGET_DATABASE_URL === undefined) {
        delete process.env.TARGET_DATABASE_URL
      }
      if (before.MVP_DATABASE_URL === undefined) {
        delete process.env.MVP_DATABASE_URL
      }
    }
  })

  it("hands out a read-only source, and a read-only target in a dry run", async () => {
    const approved = await approve("dry-run")
    const driver = fakeDriver()
    const connections = await openMigrationConnections(approved, driver)
    expect(connections.targetIsWritable).toBe(false)
    // The driver is told, so the setting is in the connection's start-up
    // and survives a reconnect; then the server is asked.
    expect(driver.opened.map((entry) => entry.readOnly)).toEqual([true, true])
    expect(driver.sessions.get(approved.sourceUrl)!.queries).toEqual(READ_ONLY)
    expect(driver.sessions.get(approved.targetUrl)!.queries).toEqual(READ_ONLY)
    // What comes back cannot be rearranged: a dry run stays a dry run.
    expect(Object.isFrozen(connections)).toBe(true)
    expect(() => {
      ;(connections as { targetIsWritable: boolean }).targetIsWritable = true
    }).toThrow(TypeError)
  })

  it("leaves the target writable only for --apply; the source stays read-only", async () => {
    const approved = await approve("apply")
    const driver = fakeDriver()
    const connections = await openMigrationConnections(approved, driver)
    expect(connections.targetIsWritable).toBe(true)
    expect(driver.opened.map((entry) => entry.readOnly)).toEqual([true, false])
    expect(driver.sessions.get(approved.sourceUrl)!.queries).toEqual(READ_ONLY)
    expect(driver.sessions.get(approved.targetUrl)!.queries).toEqual([])
  })

  it("closes a session the server did not make read-only, and opens no other", async () => {
    const approved = await approve()
    const driver = fakeDriver({ readOnlyAnswer: "off" })
    await expect(
      openMigrationConnections(approved, driver)
    ).rejects.toMatchObject({ code: "NOT_READ_ONLY", side: "source" })
    expect(driver.sessions.get(approved.sourceUrl)!.ended).toBe(1)
    expect(driver.opened.map((entry) => entry.url)).toEqual([
      approved.sourceUrl,
    ])
  })

  it('refuses any answer but "on", whatever shape the driver gives it', async () => {
    const approved = await approve()
    for (const rows of [
      [],
      [{}],
      [{ default_transaction_read_only: "ON " }],
      [{ default_transaction_read_only: true }],
      [["on"]] as unknown as Record<string, unknown>[],
    ]) {
      let ended = 0
      const open: OpenMigrationSession = async () => ({
        query: async (text) =>
          text.startsWith("SHOW") ? { rows } : { rows: [] },
        end: async () => {
          ended += 1
        },
      })
      await expect(
        openMigrationConnections(approved, { open })
      ).rejects.toMatchObject({ code: "NOT_READ_ONLY" })
      expect(ended).toBe(1)
    }
  })

  it("closes the source when the target cannot be opened, and says nothing secret", async () => {
    const approved = await approve()
    const driver = fakeDriver({ failOn: TARGET_HOST })
    const error = await openMigrationConnections(approved, driver).catch(
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(MigrationConnectError)
    expect(error).toMatchObject({
      code: "CONNECT_FAILED",
      side: "target",
      message: "could not connect to the target database (Error)",
    })
    expect(driver.sessions.get(approved.sourceUrl)!.ended).toBe(1)
    const said = JSON.stringify(error, Object.getOwnPropertyNames(error))
    expect(said).not.toContain(SECRET)
    expect(said).not.toContain(TARGET_HOST)
    expect(said).not.toContain("postgresql://")
  })

  it("says which side failed without the driver's own words", async () => {
    const approved = await approve()
    for (const [options, side, code] of [
      [{ failOn: SOURCE_HOST }, "source", "CONNECT_FAILED"],
      [{ failSetOn: SOURCE_HOST }, "source", "NOT_READ_ONLY"],
      [{ failSetOn: TARGET_HOST }, "target", "NOT_READ_ONLY"],
    ] as const) {
      const error = (await openMigrationConnections(
        approved,
        fakeDriver(options)
      ).catch((caught: unknown) => caught)) as MigrationConnectError
      expect(error).toMatchObject({ code, side })
      expect(error.message).not.toContain(SECRET)
      expect(error.message).not.toMatch(/neon\.tech|postgresql:|ECONNREFUSED/)
    }
  })

  it("says what kind of failure it was by the driver's code, never by its words", async () => {
    const approved = await approve()
    const wrongPassword = (await openMigrationConnections(
      approved,
      fakeDriver({ failOn: SOURCE_HOST, failCode: "28P01" })
    ).catch((caught: unknown) => caught)) as MigrationConnectError
    expect(wrongPassword.message).toBe(
      "could not connect to the source database (Error, 28P01)"
    )
    // A "code" that is not one is not shown.
    const hostile = (await openMigrationConnections(
      approved,
      fakeDriver({
        failOn: SOURCE_HOST,
        failCode: `postgresql://reader:${SECRET}@h/db`,
      })
    ).catch((caught: unknown) => caught)) as MigrationConnectError
    expect(hostile.message).toBe(
      "could not connect to the source database (Error)"
    )
  })

  it("gives up on a database that does not answer, and closes it if it answers late", async () => {
    const approved = await approve()
    const driver = fakeDriver({ slowOn: { host: TARGET_HOST, ms: 80 } })
    const error = (await openMigrationConnections(approved, {
      open: driver.open,
      timeoutMs: 20,
    }).catch((caught: unknown) => caught)) as MigrationConnectError
    expect(error).toMatchObject({
      code: "CONNECT_TIMED_OUT",
      side: "target",
    })
    // The source, opened first, was closed when the target gave no answer.
    expect(driver.sessions.get(approved.sourceUrl)!.ended).toBe(1)
    // The late target session is not left open behind the run.
    await vi.waitFor(() => {
      expect(driver.sessions.get(approved.targetUrl)?.ended).toBe(1)
    })
  })

  it("gives up on a database that connects and then says nothing", async () => {
    const approved = await approve()
    let ended = 0
    const open: OpenMigrationSession = async () => ({
      // The read-only check never gets an answer.
      query: () => new Promise(() => undefined),
      end: async () => {
        ended += 1
      },
    })
    await expect(
      openMigrationConnections(approved, { open, timeoutMs: 20 })
    ).rejects.toMatchObject({ code: "CONNECT_TIMED_OUT", side: "source" })
    await vi.waitFor(() => expect(ended).toBe(1))
  })

  it("treats a driver that throws at once like one that fails later", async () => {
    const approved = await approve()
    const open = (() => {
      // Not a rejected promise: thrown before one exists.
      throw new Error(`bad config ${approved.sourceUrl}`)
    }) as unknown as OpenMigrationSession
    const error = (await openMigrationConnections(approved, { open }).catch(
      (caught: unknown) => caught
    )) as MigrationConnectError
    expect(error).toBeInstanceOf(MigrationConnectError)
    expect(error).toMatchObject({ code: "CONNECT_FAILED", side: "source" })
    expect(error.message).not.toContain(SECRET)
  })

  it("names an exit status for every failure, and none of them is 0", () => {
    expect(MIGRATION_CONNECT_EXIT).toEqual({
      // A bug in the caller, not a database that did not answer.
      NOT_APPROVED: 1,
      CONNECT_FAILED: 3,
      CONNECT_TIMED_OUT: 3,
      NOT_READ_ONLY: 3,
    })
    expect(Object.isFrozen(MIGRATION_CONNECT_EXIT)).toBe(true)
  })

  it("refuses a driver that hands back something that is not a session", async () => {
    const approved = await approve("apply")
    for (const notASession of [undefined, null, {}, { query: () => 1 }]) {
      const open = (async () => notASession) as unknown as OpenMigrationSession
      await expect(
        openMigrationConnections(approved, { open })
      ).rejects.toMatchObject({ code: "CONNECT_FAILED", side: "source" })
    }
  })

  it("closes both sessions, once, however often it is asked", async () => {
    const approved = await approve()
    const driver = fakeDriver()
    const connections = await openMigrationConnections(approved, driver)
    await connections.close()
    await connections.close()
    expect(driver.sessions.get(approved.sourceUrl)!.ended).toBe(1)
    expect(driver.sessions.get(approved.targetUrl)!.ended).toBe(1)
  })

  it("does not throw from close when a session will not end", async () => {
    const approved = await approve()
    const driver = fakeDriver()
    const connections = await openMigrationConnections(approved, driver)
    connections.source.end = async () => {
      throw new Error(`socket hang up ${approved.sourceUrl}`)
    }
    await expect(connections.close()).resolves.toBeUndefined()
  })
})

describe("the package's files", () => {
  const SRC = import.meta.dirname
  const PACKAGE = path.resolve(SRC, "..")
  const CODE = /\.([cm]?[jt]s|[jt]sx)$/
  const TEST = /\.test\.([cm]?[jt]s|[jt]sx)$/

  /** Every code file under a folder that is not a test, at any depth. */
  const codeFiles = (root: string) =>
    (readdirSync(root, { recursive: true }) as string[])
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => !/^node_modules\//.test(file))
      .filter((file) => CODE.test(file) && !TEST.test(file))
  /** The package's own code: everything but its tests and its tool configs. */
  const sources = () =>
    codeFiles(PACKAGE).filter(
      (file) => !/^[\w.-]+\.config\.[cm]?[jt]s$/.test(file)
    )
  // The text as it is written, comments included. Taking comments out
  // first is how a scan gets fooled (a "/*" inside a string hides the code
  // after it), so these files do not use the scanned words in comments.
  const text = (file: string) => readFileSync(path.join(PACKAGE, file), "utf8")
  /** What a piece of code imports from a named place, by any way to import. */
  const imports = (source: string) =>
    [
      ...source.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(\s*\(*\s*|\brequire\s*\(\s*\(*\s*|\bimport\s*)["'`]([^"'`]*)["'`]/g
      ),
    ].map((match) => match[1]!)
  /** An import or require whose target is worked out, not written. */
  const COMPUTED = /\b(?:import|require)\s*\(\s*\(*\s*(?!["'`(])[^)\s]/

  // What a file here may import: a neighbour inside src, the one part of
  // Node the terminal needs, and zod. A list of what is allowed, not of
  // what is forbidden: `@eleva/db` opens a connection from the environment,
  // and no list of driver names would have thought of it. The next slice
  // that needs more (a file to write a report, a driver in connect.ts)
  // changes this list in the open, which is the conversation to have.
  const allowed = (file: string, specifier: string) => {
    if (specifier === "zod" || specifier === "node:readline/promises") {
      return true
    }
    if (!/^\.{1,2}\//.test(specifier)) return false
    // A neighbour that stays inside src ("../../packages/db" is a relative
    // path too), and not a test file or anything installed.
    const resolved = path.resolve(PACKAGE, path.dirname(file), specifier)
    return (
      resolved.startsWith(`${SRC}${path.sep}`) &&
      !resolved.includes(`${path.sep}node_modules${path.sep}`) &&
      !/\.test(\.|$)/.test(path.basename(resolved))
    )
  }
  /** Why a file's imports are not all allowed, or an empty list. */
  const importOffences = (file: string, source: string) => [
    ...imports(source)
      .filter((specifier) => !allowed(file, specifier))
      .map((specifier) => `${file}: ${specifier}`),
    ...(COMPUTED.test(source) ? [`${file}: an import that is worked out`] : []),
  ]

  it("the package's code is all in src", () => {
    expect(sources().every((file) => file.startsWith("src/"))).toBe(true)
    expect(sources()).toContain("src/connect.ts")
  })

  it("no file but connect.ts imports anything that could open a connection", () => {
    expect(
      sources()
        .filter((file) => file !== "src/connect.ts")
        .flatMap((file) => importOffences(file, text(file)))
    ).toEqual([])
    // connect.ts itself imports no driver yet, and says so.
    expect(importOffences("src/connect.ts", text("src/connect.ts"))).toEqual([])
  })

  it("the check would catch a driver, the product's own client, a path out of the package, and a file in a folder", () => {
    for (const line of [
      'import { Client } from "pg"',
      'import{Client}from"pg"',
      'import { Pool } from "@neondatabase/serverless"',
      'import { db } from "@eleva/db"',
      'import type { Tx } from "@eleva/db"',
      'import "pg"',
      'import"pg"',
      'const { Client } = await import("pg")',
      "const { Client } = await import(`pg`)",
      'const { Client } = await import(("pg"))',
      "const driver = await import(name)",
      "const driver = require(name)",
      'const pg = require("pg/lib/client")',
      'import net from "node:net"',
      'import { env } from "node:process"',
      'import { readFileSync } from "node:fs"',
      'import { db } from "../../../packages/db/src/index"',
      'import pg from "../node_modules/pg/lib/index.js"',
      'import { helper } from "./cli.test"',
      'const sep = "a//"; await import("pg")',
      'const glob = "migrations/*.sql"; await import("pg") /* */',
    ]) {
      expect(importOffences("src/x.ts", line), line).not.toEqual([])
    }
    for (const [file, line] of [
      ["src/x.ts", 'import { z } from "zod"'],
      ["src/x.ts", 'import { directHost } from "./guard"'],
      ["src/map/users.ts", 'import { directHost } from "../guard"'],
      ["src/x.ts", 'import { createInterface } from "node:readline/promises"'],
    ] as const) {
      expect(importOffences(file, line), line).toEqual([])
    }
    // The walk goes into folders and knows every kind of code file.
    const scratch = mkdtempSync(path.join(tmpdir(), "migration-scan-"))
    try {
      mkdirSync(path.join(scratch, "src", "map"), { recursive: true })
      mkdirSync(path.join(scratch, "scripts"), { recursive: true })
      writeFileSync(path.join(scratch, "src", "map", "users.mts"), "")
      writeFileSync(path.join(scratch, "src", "map", "view.tsx"), "")
      writeFileSync(path.join(scratch, "src", "map", "users.test.ts"), "")
      writeFileSync(path.join(scratch, "scripts", "run.js"), "")
      expect(codeFiles(scratch).sort()).toEqual([
        "scripts/run.js",
        "src/map/users.mts",
        "src/map/view.tsx",
      ])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("the package depends on nothing that connects", () => {
    const manifest = JSON.parse(text("package.json")) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      scripts: Record<string, string>
    }
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["zod"])
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual([
      "@eleva/eslint-config",
      "@eleva/typescript-config",
      "@types/node",
      "eslint",
      "tsx",
      "typescript",
      "vitest",
    ])
    expect(manifest.optionalDependencies).toBeUndefined()
    expect(manifest.peerDependencies).toBeUndefined()
    // The command as the README gives it: no file of variables is loaded.
    expect(manifest.scripts.guard).toBe("tsx src/main.ts guard")
  })

  it("only main.ts touches the process, and only neon-api.ts the network", () => {
    // The environment, the arguments, the terminal, a `.env` loader: all
    // of it is reached through `process`, so the word itself is the test.
    const using = (word: RegExp) =>
      sources().filter((file) => word.test(text(file)))
    expect(using(/\bprocess\b/)).toEqual(["src/main.ts"])
    // The same for what reaches the network or the globals without an
    // import: Neon answers SQL over HTTPS, so `fetch` is a driver too.
    expect(using(/\b(fetch|WebSocket|XMLHttpRequest)\b/)).toEqual([
      "src/neon-api.ts",
    ])
    expect(using(/\bglobalThis\b/)).toEqual(["src/neon-api.ts"])
  })

  it("the guard is asked in one place, the command run from one place, and Neon's real answer built in one place", () => {
    const users = (name: string) =>
      sources().filter((file) => text(file).includes(name))
    // By the name, however it is imported, renamed or called: a second
    // caller could bring its own answers from Neon and get a real
    // approval for them.
    expect(users("assertMigrationTarget")).toEqual([
      "src/cli.ts",
      "src/guard.ts",
    ])
    expect(users("runMigrationCommand")).toEqual(["src/cli.ts", "src/main.ts"])
    expect(users("createNeonEndpointResolver")).toEqual([
      "src/main.ts",
      "src/neon-api.ts",
    ])
    // The way to open a session stays in the one file that may connect: no
    // other file is handed a driver to call with a URL of its own.
    expect(users("OpenMigrationSession")).toEqual(["src/connect.ts"])
  })

  it("no script loads a file of variables", () => {
    const { scripts } = JSON.parse(text("package.json")) as {
      scripts: Record<string, string>
    }
    for (const [name, script] of Object.entries(scripts)) {
      expect(script, name).not.toMatch(/env-file|dotenv|\.env\b/)
    }
    expect(text("src/main.ts")).not.toMatch(/loadEnvFile|dotenv/)
  })
})
