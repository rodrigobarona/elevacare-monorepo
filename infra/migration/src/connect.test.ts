import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
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
      // A bug in the caller, not a database that did not answer: 1, not 3.
      await expect(
        openMigrationConnections(forged, driver)
      ).rejects.toMatchObject({ code: "NOT_APPROVED", exitCode: 1 })
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
      ).rejects.toMatchObject({ code: "NOT_READ_ONLY", exitCode: 3 })
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
      exitCode: 3,
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
      exitCode: 3,
    })
    // The source, opened first, was closed when the target gave no answer.
    expect(driver.sessions.get(approved.sourceUrl)!.ended).toBe(1)
    // The late target session is not left open behind the run.
    await vi.waitFor(() => {
      expect(driver.sessions.get(approved.targetUrl)?.ended).toBe(1)
    })
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
  /** Every source file that is not a test, in any folder under src. */
  const sources = () =>
    (readdirSync(SRC, { recursive: true }) as string[])
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => file.split(path.sep).join("/"))
  const read = (file: string) => readFileSync(path.join(SRC, file), "utf8")
  /** What a file imports, by any of the three ways to import. */
  const imports = (source: string) =>
    [
      ...source.matchAll(
        /(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm
      ),
    ].map((match) => match[1]!)

  // What a file here may import: its neighbours, a few parts of Node that
  // open nothing, and zod. A list of what is allowed, not of what is
  // forbidden: `@eleva/db` opens a connection from the environment, and no
  // list of driver names would have thought of it.
  const ALLOWED =
    /^(\.{1,2}\/[\w./-]+|node:(readline\/promises|path|fs|crypto)|zod)$/

  it("no file but connect.ts imports anything that could open a connection", () => {
    const offenders = sources()
      .filter((file) => file !== "connect.ts")
      .flatMap((file) =>
        imports(read(file))
          .filter((specifier) => !ALLOWED.test(specifier))
          .map((specifier) => `${file}: ${specifier}`)
      )
    expect(offenders).toEqual([])
  })

  it("the check would catch a driver, the product's own database client, and a file in a folder", () => {
    for (const line of [
      'import { Client } from "pg"',
      'import { Pool } from "@neondatabase/serverless"',
      'import { db } from "@eleva/db"',
      'import "pg"',
      'const { Client } = await import("pg")',
      'const pg = require("pg/lib/client")',
      'import net from "node:net"',
      'import { env } from "node:process"',
    ]) {
      expect(
        imports(line).some((specifier) => !ALLOWED.test(specifier)),
        line
      ).toBe(true)
    }
    for (const line of [
      'import { z } from "zod"',
      'import { directHost } from "./guard"',
      'import { map } from "../map/users"',
      'import { createInterface } from "node:readline/promises"',
    ]) {
      expect(
        imports(line).every((specifier) => ALLOWED.test(specifier)),
        line
      ).toBe(true)
    }
    // The walk goes into folders.
    expect(sources()).toContain("connect.ts")
    expect(readdirSync(SRC, { recursive: true }).length).toBeGreaterThan(0)
  })

  it("the package depends on nothing that connects", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(PACKAGE, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>
      scripts: Record<string, string>
    }
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["zod"])
    // The command as the README gives it: no file of variables is loaded.
    expect(manifest.scripts.guard).toBe("tsx src/main.ts guard")
  })

  it("only main.ts reads the process's environment or arguments", () => {
    const READS_PROCESS =
      /\bprocess\s*(\.|\[)\s*["']?(env|argv)|=\s*process\b|node:process/
    const offenders = sources()
      .filter((file) => file !== "main.ts")
      .filter((file) => READS_PROCESS.test(read(file)))
    expect(offenders).toEqual([])
    for (const line of [
      "process.env.X",
      'process["env"]',
      "const { env } = process",
      'import { env } from "node:process"',
      "process.argv.slice(2)",
    ]) {
      expect(READS_PROCESS.test(line), line).toBe(true)
    }
    expect(READS_PROCESS.test("approved in this process.")).toBe(false)
  })

  it("the guard is asked in one place, with the real question to Neon built in one place", () => {
    const callers = (call: RegExp) =>
      sources().filter((file) => call.test(read(file)))
    // Defined in guard.ts, called from cli.ts: a second caller could bring
    // its own answers from Neon and get a real approval for them.
    expect(callers(/\bassertMigrationTarget\(/)).toEqual(["cli.ts", "guard.ts"])
    expect(callers(/\bcreateNeonEndpointResolver\(/)).toEqual([
      "main.ts",
      "neon-api.ts",
    ])
  })
})
