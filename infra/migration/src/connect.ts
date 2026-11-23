import {
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
 * in a dry run: a mapper with a bug cannot write. This is a second
 * safeguard; the first is the read-only database role the operator creates
 * for the MVP.
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
  | "NOT_READ_ONLY"

export type MigrationSide = "source" | "target"

/**
 * A failure to connect after the guard approved the target. It exits 3, so
 * an operator can tell "refused" (2, nothing was tried) from "approved,
 * and the database did not answer".
 */
export class MigrationConnectError extends Error {
  readonly exitCode = 3

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

/** Opens one session on a connection string. The driver lives behind it. */
export type OpenMigrationSession = (url: string) => Promise<MigrationSession>

export interface MigrationConnections {
  /** The MVP database. Always read-only. */
  source: MigrationSession
  /** The v3 database. Read-only unless the run is `--apply`. */
  target: MigrationSession
  targetIsWritable: boolean
  /** Closes both sessions. Safe to call twice. */
  close: () => Promise<void>
}

/** What went wrong, by its class only: a driver's message can name a host. */
function kindOf(error: unknown): string {
  return error instanceof Error ? error.name : "unknown error"
}

/**
 * A session setting does not hold on a pooled host (the pool hands each
 * transaction to whichever server connection is free), so "read-only" set
 * there would be a hope, not a fact.
 */
function refusePooledHost(url: string, side: MigrationSide): void {
  const host = new URL(url).hostname
  if (/^[^.]+-pooler\./.test(host)) {
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
  readOnly: boolean
): Promise<MigrationSession> {
  let session: MigrationSession
  try {
    session = await open(url)
  } catch (error) {
    throw new MigrationConnectError(
      "CONNECT_FAILED",
      `could not connect to the ${side} database (${kindOf(error)})`,
      side
    )
  }
  if (!readOnly) return session
  try {
    // For every transaction of this session, then checked: the setting is
    // read back from the server, not assumed.
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
      `the ${side} session could not be made read-only (${kindOf(error)}), so it was closed`,
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
  deps: { open: OpenMigrationSession }
): Promise<MigrationConnections> {
  if (!isApprovedMigrationTarget(approved)) {
    throw new MigrationConnectError(
      "NOT_APPROVED",
      "this target was not approved by the guard in this run. Nothing was connected to"
    )
  }
  refusePooledHost(approved.sourceUrl, "source")
  refusePooledHost(approved.targetUrl, "target")

  const targetIsWritable = approved.mode === "apply"
  const source = await openSide(deps.open, approved.sourceUrl, "source", true)
  let target: MigrationSession
  try {
    target = await openSide(
      deps.open,
      approved.targetUrl,
      "target",
      !targetIsWritable
    )
  } catch (error) {
    // One side open and the other not is not a state to leave behind.
    await endQuietly(source)
    throw error
  }

  let closed = false
  return {
    source,
    target,
    targetIsWritable,
    close: async () => {
      if (closed) return
      closed = true
      await Promise.all([endQuietly(source), endQuietly(target)])
    },
  }
}
