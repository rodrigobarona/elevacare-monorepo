/**
 * Command line of the migration tools (Phase 14). Every flag has a default,
 * and the default never writes: a run is a dry run against a rehearsal
 * branch unless the operator says otherwise.
 */

export type MigrationMode = "dry-run" | "apply"
export type MigrationTargetKind = "branch" | "production"

export interface MigrationArgs {
  mode: MigrationMode
  target: MigrationTargetKind
  /** Delta run: only source rows changed since this instant. */
  since: Date | null
  /** Where the run report is written; the tool picks a dated path when null. */
  report: string | null
}

export class MigrationArgsError extends Error {
  /** Usage errors exit 2, before anything is opened. */
  readonly exitCode = 2

  constructor(message: string) {
    super(message)
    this.name = "MigrationArgsError"
  }
}

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

function valueOf(flag: string, argv: readonly string[], index: number): string {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith("--")) {
    throw new MigrationArgsError(`${flag} needs a value`)
  }
  return value
}

export function parseMigrationArgs(argv: readonly string[]): MigrationArgs {
  let dryRun = false
  let apply = false
  let target: MigrationTargetKind = "branch"
  let since: Date | null = null
  let report: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!
    switch (flag) {
      case "--dry-run":
        dryRun = true
        break
      case "--apply":
        apply = true
        break
      case "--target": {
        const value = valueOf(flag, argv, index)
        if (value !== "branch" && value !== "production") {
          throw new MigrationArgsError(
            `--target must be "branch" or "production", not "${value}"`
          )
        }
        target = value
        index += 1
        break
      }
      case "--since": {
        const value = valueOf(flag, argv, index)
        const instant = new Date(value)
        if (!ISO_INSTANT.test(value) || Number.isNaN(instant.getTime())) {
          throw new MigrationArgsError(
            `--since must be an ISO-8601 instant with a time zone (for example 2026-11-21T10:00:00Z), not "${value}"`
          )
        }
        since = instant
        index += 1
        break
      }
      case "--report":
        report = valueOf(flag, argv, index)
        index += 1
        break
      default:
        throw new MigrationArgsError(`unknown argument "${flag}"`)
    }
  }

  if (dryRun && apply) {
    throw new MigrationArgsError("choose one of --dry-run and --apply")
  }
  return { mode: apply ? "apply" : "dry-run", target, since, report }
}
