import { MigrationArgsError, parseMigrationArgs } from "./args"
import { MIGRATION_CONNECT_EXIT, MigrationConnectError } from "./connect"
import {
  assertMigrationTarget,
  errorKind,
  MigrationGuardError,
  type MigrationGuardDeps,
  type MigrationGuardEnv,
} from "./guard"

/**
 * The migration tool's command line (Phase 14.2). One command exists:
 * `guard`, which runs the target guard and stops. It opens no database
 * connection and writes nothing; its only network calls are the guard's
 * two read-only questions to the Neon API. It takes the same flags a real
 * run will take, so what it approves is exactly what that run would do.
 *
 * The work is a function of its arguments, the environment it is given and
 * its dependencies, and returns the exit status. `main.ts` hands it the
 * real ones. It never loads a `.env` file: the operator sets the variables
 * for the run (execution-plan README, rule 13).
 */

/** What each exit status means. The README carries the same table. */
export const MIGRATION_EXIT = Object.freeze({
  /** The guard approved the target. */
  approved: 0,
  /** Something unexpected: a bug or a crash. Never read as approval. */
  unexpected: 1,
  /** Refused: a usage error or a guard refusal. Nothing was connected to. */
  refused: 2,
  /**
   * Approved, a connection was tried, and the database did not answer or
   * would not be read-only (`MigrationConnectError`). No command connects
   * yet; the status is fixed now so the table does not change when one does.
   */
  connectFailed: 3,
} as const)

/**
 * What the program ends with: the status the command returned when it is
 * one the table names, and 1 for anything else. A value that is not a
 * status is a bug, and a bug never ends as 0.
 */
export function exitStatus(returned: unknown): 0 | 1 | 2 | 3 {
  return returned === 0 || returned === 2 || returned === 3 ? returned : 1
}

export interface MigrationCommandEnv extends MigrationGuardEnv {
  /** Reads the Neon API. Needed to learn which branch the target is. */
  NEON_API_KEY?: string
}

export interface MigrationCommandDeps {
  /** Builds the question to Neon. Called at most once, and only with a key. */
  createResolver: (options: {
    apiKey: string
    projectId: string
  }) => MigrationGuardDeps["resolveEndpoint"]
  prompt: MigrationGuardDeps["prompt"]
  isInteractive: MigrationGuardDeps["isInteractive"]
  now: MigrationGuardDeps["now"]
  /** One line to standard output. */
  out: (line: string) => void
  /** One line to standard error. */
  err: (line: string) => void
}

/** The variables a run reads. Nothing else in the environment is handed on. */
const VARIABLES = [
  "TARGET_DATABASE_URL",
  "MVP_DATABASE_URL",
  "NEON_PROJECT_ID",
  "NEON_API_KEY",
  "MIGRATION_ALLOWED_TARGET_HOSTS",
  "MIGRATION_CONFIRM_PRODUCTION",
  "NODE_TLS_REJECT_UNAUTHORIZED",
] as const

/**
 * The part of an environment the command may see: its own variables, and
 * the `PG*` ones so the guard can refuse a run that has one set. A
 * `DATABASE_URL` left in a shell never reaches the command.
 */
export function migrationEnv(
  all: Record<string, string | undefined>
): MigrationCommandEnv {
  return Object.fromEntries(
    Object.entries(all).filter(
      ([name]) =>
        (VARIABLES as readonly string[]).includes(name) ||
        /^PG[A-Z_]+$/.test(name)
    )
  )
}

const COMMANDS = ["guard"] as const

export async function runMigrationCommand(
  argv: readonly string[],
  env: MigrationCommandEnv,
  deps: MigrationCommandDeps
): Promise<number> {
  try {
    const [command, ...rest] = argv
    // `pnpm <script> -- --flag` hands the "--" on: it is not a flag.
    const flags = rest[0] === "--" ? rest.slice(1) : rest
    if (command !== "guard") {
      throw new MigrationArgsError(
        command
          ? `unknown command. The commands are: ${COMMANDS.join(", ")}`
          : `name a command: ${COMMANDS.join(", ")}`
      )
    }
    const args = parseMigrationArgs(flags)

    // Neon is asked only once the guard has checked everything it can
    // check without it, and never without a key: a missing key is a
    // refusal decided before any network call.
    let resolver: MigrationGuardDeps["resolveEndpoint"] | null = null
    const resolveEndpoint: MigrationGuardDeps["resolveEndpoint"] = (host) => {
      if (!resolver) {
        const apiKey = env.NEON_API_KEY?.trim()
        if (!apiKey) {
          throw new MigrationGuardError(
            "NEON_API_KEY_MISSING",
            "NEON_API_KEY is not set, so Neon cannot be asked which branch the target is"
          )
        }
        // A key with a space, a line break or anything else that is not
        // plain printable text was pasted wrong. It is refused here: sent
        // as a header, the runtime's own error would quote it.
        if (!/^[\x21-\x7e]+$/.test(apiKey) || /:\/\/|@/.test(apiKey)) {
          throw new MigrationGuardError(
            "NEON_API_KEY_INVALID",
            "NEON_API_KEY has a space, a line break or another character a key never has, or is a connection string. Set it to the key alone"
          )
        }
        resolver = deps.createResolver({
          apiKey,
          // The guard refuses a missing project id before it asks Neon.
          projectId: env.NEON_PROJECT_ID?.trim() ?? "",
        })
      }
      return resolver(host)
    }

    const approved = await assertMigrationTarget(
      { target: args.target, mode: args.mode, env },
      {
        resolveEndpoint,
        prompt: deps.prompt,
        isInteractive: deps.isInteractive,
        now: deps.now,
      }
    )
    // What was approved, by its names only, on one line: never a
    // connection string, a user or a password.
    deps.out(
      `approved: target=${approved.kind} mode=${approved.mode} host=${approved.host} project=${approved.projectId} branch=${JSON.stringify(approved.branchName)} (${approved.branchId}) source=${approved.sourceHost}. The guard ran and stopped: no database was connected to.`
    )
    return MIGRATION_EXIT.approved
  } catch (error) {
    if (error instanceof MigrationArgsError) {
      deps.err(`refused USAGE: ${error.message}`)
      return MIGRATION_EXIT.refused
    }
    if (error instanceof MigrationGuardError) {
      deps.err(`refused ${error.code}: ${error.message}`)
      return MIGRATION_EXIT.refused
    }
    // For the commands that will connect: which side, and what kind of
    // failure, in the module's own words.
    if (error instanceof MigrationConnectError) {
      // The status is looked up by the code in a closed table. It is
      // never taken from the error object, and an unknown code is a bug:
      // nothing here can turn a failure into 0.
      // Read once: an object can answer differently each time it is asked.
      const code = error.code
      const side = error.side
      const known =
        typeof code === "string" && Object.hasOwn(MIGRATION_CONNECT_EXIT, code)
      deps.err(
        known
          ? `failed ${code}${side === "source" || side === "target" ? ` (${side})` : ""}: ${error.message}`
          : "failed: unexpected MigrationConnectError"
      )
      return known ? MIGRATION_CONNECT_EXIT[code] : MIGRATION_EXIT.unexpected
    }
    // Its class only: the message of an unknown error is not ours, and
    // could carry a connection string.
    deps.err(`failed: unexpected ${errorKind(error)}`)
    return MIGRATION_EXIT.unexpected
  }
}
