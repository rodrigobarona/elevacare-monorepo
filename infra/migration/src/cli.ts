import { MigrationArgsError, parseMigrationArgs } from "./args"
import {
  assertMigrationTarget,
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
export const MIGRATION_EXIT = {
  /** The guard approved the target. */
  approved: 0,
  /** Something unexpected: a bug or a crash. Never read as approval. */
  unexpected: 1,
  /** Refused: a usage error or a guard refusal. Nothing was connected to. */
  refused: 2,
  /** Approved, and a connection then failed (`MigrationConnectError`). */
  connectFailed: 3,
} as const

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

const COMMANDS = ["guard"] as const

export async function runMigrationCommand(
  argv: readonly string[],
  env: MigrationCommandEnv,
  deps: MigrationCommandDeps
): Promise<number> {
  try {
    const [command, ...flags] = argv
    if (command !== "guard") {
      throw new MigrationArgsError(
        command
          ? `unknown command "${command}". The commands are: ${COMMANDS.join(", ")}`
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
    // What was approved, by its names only: never a connection string, a
    // user or a password.
    deps.out(
      `approved: target=${approved.kind} mode=${approved.mode} host=${approved.host} project=${approved.projectId} branch=${approved.branchName} (${approved.branchId})`
    )
    deps.out("The guard ran and stopped: no database was connected to.")
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
    // Its class only: the message of an unknown error is not ours, and
    // could carry a connection string.
    deps.err(
      `failed: unexpected ${error instanceof Error ? error.name : "error"}. No database was connected to.`
    )
    return MIGRATION_EXIT.unexpected
  }
}
