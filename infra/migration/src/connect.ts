import {
  directHost,
  errorKind,
  isApprovedMigrationTarget,
  type ApprovedMigrationTarget,
} from "./guard"

/**
 * The one place in this package that opens database connections (Phase
 * 14.2). Two rules hold here and nowhere else has to repeat them:
 *
 * - Nothing is opened without a target the guard approved in this process.
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
 * the v3 side in a dry run there is no such role: this setting is the
 * safeguard there is, which is one more reason a dry run only ever runs
 * against a rehearsal branch.
 *
 * No driver is installed yet. The driver comes in through `open`, and the
 * first command that connects (14.3) adds the real one in this file, once
 * it is known what the MVP's production database runs on (F-02). A test
 * keeps every other file in the package from importing one.
 */

export type MigrationConnectErrorCode =
  | "NOT_APPROVED"
  | "POOLED_HOST"
  | "CONNECT_FAILED"
  | "CONNECT_TIMED_OUT"
  | "NOT_READ_ONLY"

export type MigrationSide = "source" | "target"

/**
 * 3: the guard approved, a connection was tried, and the database did not
 * answer or would not be read-only. 2: refused before anything was tried
 * (the guard's own check, repeated here). 1: a bug in the caller.
 */
const EXIT_OF: Record<MigrationConnectErrorCode, 1 | 2 | 3> = {
  NOT_APPROVED: 1,
  POOLED_HOST: 2,
  CONNECT_FAILED: 3,
  CONNECT_TIMED_OUT: 3,
  NOT_READ_ONLY: 3,
}

export class MigrationConnectError extends Error {
  readonly exitCode: 1 | 2 | 3

  constructor(
    readonly code: MigrationConnectErrorCode,
    message: string,
    readonly side: MigrationSide | null = null
  ) {
    super(message)
    this.name = "MigrationConnectError"
    this.exitCode = EXIT_OF[code]
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
 *
 * It must return **one dedicated connection, never a pool**: a pool has
 * the same shape and would run each query on whichever connection is free,
 * which undoes the read-only setting, a snapshot and any transaction. With
 * `readOnly`, the driver sets `default_transaction_read_only=on` in the
 * connection's own start-up options, so the setting is there from the
 * first statement and comes back if the driver ever reconnects.
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

/** How long a connection may take to open before the run gives up on it. */
export const CONNECT_TIMEOUT_MS = 30_000

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

/** The guard refuses pooled hosts; this is the same check, kept at the door. */
function refusePooledHost(url: string, side: MigrationSide): void {
  const host = new URL(url).hostname
  if (directHost(host) !== host) {
    throw new MigrationConnectError(
      "POOLED_HOST",
      `the ${side} connection goes through a pooled host (its name has "-pooler"). A migration needs its own session: use the direct host of the same database`,
      side
    )
  }
}

async function endQuietly(session: MigrationSession): Promise<void> {
  try {
    await session.end()
  } catch {
    // Closing is best effort: the run is over either way.
  }
}

async function openSide(
  open: OpenMigrationSession,
  url: string,
  side: MigrationSide,
  readOnly: boolean,
  timeoutMs: number
): Promise<MigrationSession> {
  let session: MigrationSession
  let timer: ReturnType<typeof setTimeout> | undefined
  const opening = open(url, { readOnly })
  try {
    session = await Promise.race([
      opening,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new MigrationConnectError(
                "CONNECT_TIMED_OUT",
                `the ${side} database did not answer within ${Math.round(timeoutMs / 1000)} seconds`,
                side
              )
            ),
          timeoutMs
        )
      }),
    ])
  } catch (error) {
    if (error instanceof MigrationConnectError) {
      // Given up on: if it opens after all, it is closed, not left behind.
      void opening.then(endQuietly, () => undefined)
      throw error
    }
    throw new MigrationConnectError(
      "CONNECT_FAILED",
      `could not connect to the ${side} database (${describe(error)})`,
      side
    )
  } finally {
    clearTimeout(timer)
  }
  if (!readOnly) return session
  try {
    // Asked for at start-up by the driver, set again for every later
    // transaction of this session, then read back from the server: a fact,
    // not an assumption.
    await session.query("SET default_transaction_read_only = on")
    const { rows } = await session.query("SHOW default_transaction_read_only")
    const value = rows[0]?.default_transaction_read_only
    if (value !== "on") {
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
}

/**
 * Opens the MVP and v3 sessions for one run. `approved` must be the object
 * `assertMigrationTarget` returned; anything else is refused before `open`
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
  refusePooledHost(approved.sourceUrl, "source")
  refusePooledHost(approved.targetUrl, "target")

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
