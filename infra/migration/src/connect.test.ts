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
const TARGET_POOLED = "ep-rehearsal-a1b2c3d4-pooler.eu-central-1.aws.neon.tech"
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
        host === TARGET_HOST || host === TARGET_POOLED ? REHEARSAL : null,
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
    /** What the server says the session's setting is after `SET`. */
    readOnlyAnswer?: string
    failSetOn?: string
  } = {}
) {
  const opened: string[] = []
  const sessions = new Map<
    string,
    { queries: string[]; ended: number; session: MigrationSession }
  >()
  const open: OpenMigrationSession = vi.fn(async (url: string) => {
    opened.push(url)
    if (options.failOn && url.includes(options.failOn)) {
      // What a real driver does: the address, password included, in the text.
      throw new Error(`connect ECONNREFUSED ${url}`)
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
      await expect(
        openMigrationConnections(forged, driver)
      ).rejects.toMatchObject({ code: "NOT_APPROVED", exitCode: 3 })
    }
    expect(driver.open).not.toHaveBeenCalled()
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
      expect(driver.opened).toEqual([approved.sourceUrl, approved.targetUrl])
      expect(driver.opened[0]).toContain(SOURCE_HOST)
      expect(driver.opened[1]).toContain(TARGET_HOST)
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
    expect(driver.sessions.get(approved.sourceUrl)!.queries).toEqual(READ_ONLY)
    expect(driver.sessions.get(approved.targetUrl)!.queries).toEqual(READ_ONLY)
  })

  it("leaves the target writable only for --apply; the source stays read-only", async () => {
    const approved = await approve("apply")
    const driver = fakeDriver()
    const connections = await openMigrationConnections(approved, driver)
    expect(connections.targetIsWritable).toBe(true)
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
    expect(driver.opened).toEqual([approved.sourceUrl])
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

  it("refuses a pooled host before opening: a session setting does not hold there", async () => {
    const approved = await approve("dry-run", {
      ...ENV,
      TARGET_DATABASE_URL: `postgresql://writer:${SECRET}@${TARGET_POOLED}/eleva`,
      MIGRATION_ALLOWED_TARGET_HOSTS: TARGET_POOLED,
    })
    const driver = fakeDriver()
    const error = (await openMigrationConnections(approved, driver).catch(
      (caught: unknown) => caught
    )) as MigrationConnectError
    expect(error).toMatchObject({ code: "POOLED_HOST", side: "target" })
    expect(error.message).not.toContain(SECRET)
    expect(driver.open).not.toHaveBeenCalled()
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
  const SRC = path.dirname(new URL(import.meta.url).pathname)
  // Anything that can open a Postgres connection.
  const DRIVER =
    /from\s+["'](pg|pg-[\w-]+|postgres|@neondatabase\/[\w-]+|@vercel\/postgres|drizzle-orm(\/[\w-]+)*|kysely|knex|slonik)["']|import\(\s*["'](pg|postgres|@neondatabase\/[\w-]+)["']\s*\)|require\(\s*["'](pg|postgres|@neondatabase\/[\w-]+)["']\s*\)/

  it("only connect.ts may import a database driver", () => {
    const offenders = readdirSync(SRC)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => file !== "connect.ts")
      .filter((file) => DRIVER.test(readFileSync(path.join(SRC, file), "utf8")))
    expect(offenders).toEqual([])
  })

  it("the check would catch one", () => {
    expect(DRIVER.test('import { Client } from "pg"')).toBe(true)
    expect(DRIVER.test('import { Pool } from "@neondatabase/serverless"')).toBe(
      true
    )
    expect(DRIVER.test('const { Client } = await import("pg")')).toBe(true)
    expect(DRIVER.test('import { z } from "zod"')).toBe(false)
  })

  it("nothing but main.ts reads the process's environment or arguments", () => {
    const offenders = readdirSync(SRC)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => file !== "main.ts")
      .filter((file) =>
        /process\.(env|argv)/.test(readFileSync(path.join(SRC, file), "utf8"))
      )
    expect(offenders).toEqual([])
  })
})
