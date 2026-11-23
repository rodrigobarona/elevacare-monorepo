import {
  errorKind,
  isApprovedMigrationTarget,
  type ApprovedMigrationTarget,
} from "./guard"

/**
 * The one place in this package that opens database connections (Phase
 * 14.2). Two rules hold here and nowhere else has to repeat them:
 *
 * - Nothing is opened without a target the guard approved in this run.
 *   A hand-built object of the right shape is refused before any
 *   connection.
 * - The connection strings are the two the guard rebuilt. The environment
 *   is never read here, so changing it after approval changes nothing.
 *
 * The MVP side is read-only before it is handed out, and so is the v3 side
 * in a dry run. The driver is told to open the connection read-only, and
 * the server is then asked what the session's setting is. This guards
 * against a mapper with a bug; it does not stop code that sets out to
 * write (a session can turn the setting off again). On the MVP side the
 * real boundary is the read-only database role the operator creates. On
 * the v3 side in a dry run there is no such role: this setting is the only
 * safeguard there, on a rehearsal branch and on production alike, which
 * is why the guard asks for the same confirmation before a dry run against
 * production as before a write.
 *
 * No driver is installed yet. The driver comes in through `open`, and the
 * first command that connects (14.3) adds the real one in this file, once
 * it is known what the MVP's production database runs on (F-02). A test
 * keeps every other file in the package from importing one.
 */

export type MigrationConnectErrorCode =
  | "NOT_APPROVED"
  | "CONNECT_FAILED"
  | "CONNECT_TIMED_OUT"
  | "NOT_READ_ONLY"

export type MigrationSide = "source" | "target"

/**
 * The exit status of each failure, in one closed table. 3: the guard
 * approved, a connection was tried, and the database did not answer or
 * would not be read-only. 1: a bug in the caller. The command line reads
 * the status from this table by the error's code, never from the error
 * object, which anything could have changed.
 */
export const MIGRATION_CONNECT_EXIT: Readonly<
  Record<MigrationConnectErrorCode, 1 | 3>
> = Object.freeze({
  NOT_APPROVED: 1,
  CONNECT_FAILED: 3,
  CONNECT_TIMED_OUT: 3,
  NOT_READ_ONLY: 3,
})

export class MigrationConnectError extends Error {
  constructor(
    readonly code: MigrationConnectErrorCode,
    message: string,
    readonly side: MigrationSide | null = null
  ) {
    super(message)
    this.name = "MigrationConnectError"
  }
}

/** One open session: the little a reader or a writer needs. */
export interface MigrationSession {
  query: (
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
}

/**
 * Opens one session on a connection string. The driver lives behind it.
 * The real one will be private to this file: `open` is handed in so that
 * tests can stand in for it, and no other file is to hold one (a test
 * keeps this type's name out of every other file).
 *
 * What an implementation must do, and what the first one (14.3) has to
 * show in its own tests, because nothing here can check it:
 *
 * - Return **one dedicated connection, never a pool**: a pool has the same
 *   shape and would run each query on whichever connection is free, which
 *   undoes the read-only setting, a snapshot and any transaction.
 * - With `readOnly`, set `default_transaction_read_only=on` in the
 *   connection's own start-up options, so it holds from the first
 *   statement.
 * - Never reconnect by itself: a dropped connection fails the next query.
 *   A silent reconnect would lose the snapshot the readers share.
 * - Take everything from the URL (host, port, user, password, database)
 *   and nothing from the `PG*` variables of the environment. The guard
 *   refuses a run that has one set; the driver must not need that.
 */
export type OpenMigrationSession = (
  url: string,
  options: { readOnly: boolean }
) => Promise<MigrationSession>

export interface MigrationConnections {
  /** The MVP database. Always read-only. */
  readonly source: MigrationSession
  /** The v3 database. Read-only unless the run is `--apply`. */
  readonly target: MigrationSession
  readonly targetIsWritable: boolean
  /** Closes both sessions. Safe to call twice. */
  readonly close: () => Promise<void>
}

/** How long a connection, and its read-only check, may take in all. */
export const CONNECT_TIMEOUT_MS = 30_000
/** How long closing one session may take before the run moves on. */
const CLOSE_TIMEOUT_MS = 5_000

/**
 * What went wrong, without the driver's own words: its class, and its
 * code when it has the shape of one (`28P01`, `ENOTFOUND`). Neither can
 * carry a host or a password; a driver's message can carry the whole
 * connection string.
 */
function describe(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === "string" && /^[A-Z0-9_]{2,32}$/.test(code)
    ? `${errorKind(error)}, ${code}`
    : errorKind(error)
}

/** Closing is best effort and never waits for ever: the run is over either way. */
async function endQuietly(session: MigrationSession): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      session.end(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLOSE_TIMEOUT_MS)
      }),
    ])
  } catch {
    // A session that will not close cleanly is left to the server.
  } finally {
    clearTimeout(timer)
  }
}

async function openSide(
  open: OpenMigrationSession,
  url: string,
  side: MigrationSide,
  readOnly: boolean,
  timeoutMs: number
): Promise<MigrationSession> {
  // One deadline for the whole of it: the connection, and the read-only
  // check after it. A database that accepts a connection and then stalls
  // is given up on like one that never answers.
  let timer: ReturnType<typeof setTimeout> | undefined
  let gaveUp = false
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      gaveUp = true
      reject(
        new MigrationConnectError(
          "CONNECT_TIMED_OUT",
          `the ${side} database did not answer within ${Math.round(timeoutMs / 1000)} seconds`,
          side
        )
      )
    }, timeoutMs)
  })
  // Started inside a promise, so a driver that throws at once is handled
  // like one that fails later: its message can carry the connection string.
  const opening = Promise.resolve().then(() => open(url, { readOnly }))
  const ready = opening.then(
    async (session) => {
      // A driver that hands back something that is not a session.
      if (
        typeof session?.query !== "function" ||
        typeof session.end !== "function"
      ) {
        throw new MigrationConnectError(
          "CONNECT_FAILED",
          `the ${side} driver did not give a session`,
          side
        )
      }
      if (!readOnly) return session
      try {
        // Asked for at start-up by the driver, set again for every later
        // transaction of this session, then read back from the server: a
        // fact, not an assumption.
        await session.query("SET default_transaction_read_only = on")
        const { rows } = await session.query(
          "SHOW default_transaction_read_only"
        )
        if (rows[0]?.default_transaction_read_only !== "on") {
          throw new MigrationConnectError(
            "NOT_READ_ONLY",
            `the ${side} session did not become read-only, so it was closed`,
            side
          )
        }
        return session
      } catch (error) {
        await endQuietly(session)
        if (error instanceof MigrationConnectError) throw error
        throw new MigrationConnectError(
          "NOT_READ_ONLY",
          `the ${side} session could not be made read-only (${describe(error)}), so it was closed`,
          side
        )
      }
    },
    (error: unknown) => {
      throw new MigrationConnectError(
        "CONNECT_FAILED",
        `could not connect to the ${side} database (${describe(error)})`,
        side
      )
    }
  )
  try {
    return await Promise.race([ready, deadline])
  } catch (error) {
    if (gaveUp) {
      // Given up on: if it opens after all, it is closed, not left behind.
      void opening.then(endQuietly, () => undefined)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Opens the MVP and v3 sessions for one run. `approved` must be the object
 * the guard returned; anything else is refused before `open`
 * is called.
 */
export async function openMigrationConnections(
  approved: ApprovedMigrationTarget,
  deps: { open: OpenMigrationSession; timeoutMs?: number }
): Promise<MigrationConnections> {
  if (!isApprovedMigrationTarget(approved)) {
    throw new MigrationConnectError(
      "NOT_APPROVED",
      "this target was not approved by the guard in this run. Nothing was connected to"
    )
  }

  const timeoutMs = deps.timeoutMs ?? CONNECT_TIMEOUT_MS
  const targetIsWritable = approved.mode === "apply"
  const source = await openSide(
    deps.open,
    approved.sourceUrl,
    "source",
    true,
    timeoutMs
  )
  let target: MigrationSession
  try {
    target = await openSide(
      deps.open,
      approved.targetUrl,
      "target",
      !targetIsWritable,
      timeoutMs
    )
  } catch (error) {
    // One side open and the other not is not a state to leave behind.
    await endQuietly(source)
    throw error
  }

  let closed = false
  // Frozen: a run cannot swap the two sides or call a dry run writable.
  return Object.freeze({
    source,
    target,
    targetIsWritable,
    close: async () => {
      if (closed) return
      closed = true
      await Promise.all([endQuietly(source), endQuietly(target)])
    },
  })
}
