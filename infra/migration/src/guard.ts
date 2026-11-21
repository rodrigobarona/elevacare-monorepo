import type { MigrationMode, MigrationTargetKind } from "./args"

/**
 * The target guard of the MVP migration (Phase 14, ADR-019). It runs before
 * any connection is opened and decides whether this run may touch the
 * database `TARGET_DATABASE_URL` points to.
 *
 * - `--target branch` (the default) is a rehearsal: the host must be an
 *   endpoint of the v3 production Neon project (`NEON_PROJECT_ID`), on a
 *   branch that is not the default one, and listed in
 *   `MIGRATION_ALLOWED_TARGET_HOSTS`. A rehearsal can never reach the
 *   production branch, and never another project.
 * - `--target production` is the cutover: the host must be the default
 *   branch of that project, `MIGRATION_CONFIRM_PRODUCTION` must be today's
 *   date (UTC) and the operator types the Neon project id.
 *
 * Every refusal is a `MigrationGuardError` and exits 2.
 */

export type MigrationGuardErrorCode =
  | "TARGET_URL_MISSING"
  | "TARGET_URL_INVALID"
  | "TARGET_NOT_NEON"
  | "SOURCE_URL_MISSING"
  | "SOURCE_IS_TARGET"
  | "NEON_PROJECT_MISSING"
  | "ENDPOINT_NOT_IN_PROJECT"
  | "ENDPOINT_NOT_WRITABLE"
  | "BRANCH_UNKNOWN"
  | "DEFAULT_BRANCH_IN_BRANCH_MODE"
  | "HOST_NOT_ALLOWED"
  | "NOT_DEFAULT_BRANCH"
  | "PRODUCTION_NOT_CONFIRMED"
  | "PROJECT_ID_NOT_TYPED"

export class MigrationGuardError extends Error {
  readonly exitCode = 2

  constructor(
    readonly code: MigrationGuardErrorCode,
    message: string
  ) {
    super(message)
    this.name = "MigrationGuardError"
  }
}

/** What the Neon API says about the endpoint behind a hostname. */
export interface NeonEndpointInfo {
  endpointId: string
  projectId: string
  branchId: string
  branchName: string
  /** The project's default (production) branch. */
  isDefaultBranch: boolean
  /** A read-write compute, not a read replica. */
  isReadWrite: boolean
}

export interface MigrationGuardEnv {
  TARGET_DATABASE_URL?: string
  MVP_DATABASE_URL?: string
  NEON_PROJECT_ID?: string
  MIGRATION_ALLOWED_TARGET_HOSTS?: string
  MIGRATION_CONFIRM_PRODUCTION?: string
}

export interface MigrationGuardDeps {
  /**
   * Looks the host up in `NEON_PROJECT_ID` only. Null when that project has
   * no such endpoint (another project, another provider, a typo).
   */
  resolveEndpoint: (host: string) => Promise<NeonEndpointInfo | null>
  /** Asks the operator a question on the terminal. */
  prompt: (question: string) => Promise<string>
  now: () => Date
}

export interface ApprovedMigrationTarget {
  kind: MigrationTargetKind
  mode: MigrationMode
  host: string
  projectId: string
  branchId: string
  branchName: string
}

function hostOf(
  url: string | undefined,
  missing: MigrationGuardErrorCode,
  name: string
): string {
  if (!url?.trim()) {
    throw new MigrationGuardError(missing, `${name} is not set`)
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new MigrationGuardError(
      "TARGET_URL_INVALID",
      `${name} is not a valid connection URL`
    )
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol) || !parsed.hostname) {
    throw new MigrationGuardError(
      "TARGET_URL_INVALID",
      `${name} is not a Postgres connection URL`
    )
  }
  return parsed.hostname.toLowerCase()
}

/** `ep-name-123-pooler.region.aws.neon.tech` and its direct host are one database. */
function sameDatabaseHost(a: string, b: string): boolean {
  const direct = (host: string) => host.replace(/^([^.]+)-pooler\./, "$1.")
  return direct(a) === direct(b)
}

function allowedHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

/** Today's date in UTC, the form `MIGRATION_CONFIRM_PRODUCTION` must have. */
export function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export async function assertMigrationTarget(
  input: {
    target: MigrationTargetKind
    mode: MigrationMode
    env: MigrationGuardEnv
  },
  deps: MigrationGuardDeps
): Promise<ApprovedMigrationTarget> {
  const { env, target, mode } = input
  const host = hostOf(
    env.TARGET_DATABASE_URL,
    "TARGET_URL_MISSING",
    "TARGET_DATABASE_URL"
  )
  if (!host.endsWith(".neon.tech")) {
    throw new MigrationGuardError(
      "TARGET_NOT_NEON",
      `the target host ${host} is not a Neon endpoint`
    )
  }
  const sourceHost = hostOf(
    env.MVP_DATABASE_URL,
    "SOURCE_URL_MISSING",
    "MVP_DATABASE_URL"
  )
  if (sameDatabaseHost(sourceHost, host)) {
    throw new MigrationGuardError(
      "SOURCE_IS_TARGET",
      "MVP_DATABASE_URL and TARGET_DATABASE_URL point to the same database"
    )
  }
  const projectId = env.NEON_PROJECT_ID?.trim()
  if (!projectId) {
    throw new MigrationGuardError(
      "NEON_PROJECT_MISSING",
      "NEON_PROJECT_ID (the v3 production Neon project) is not set"
    )
  }

  const endpoint = await deps.resolveEndpoint(host)
  if (!endpoint || endpoint.projectId !== projectId) {
    throw new MigrationGuardError(
      "ENDPOINT_NOT_IN_PROJECT",
      `the target host ${host} is not an endpoint of Neon project ${projectId}`
    )
  }
  if (!endpoint.isReadWrite) {
    throw new MigrationGuardError(
      "ENDPOINT_NOT_WRITABLE",
      `the target host ${host} is a read replica`
    )
  }
  if (!endpoint.branchId || typeof endpoint.isDefaultBranch !== "boolean") {
    throw new MigrationGuardError(
      "BRANCH_UNKNOWN",
      `Neon did not say which branch ${host} belongs to`
    )
  }

  const approved: ApprovedMigrationTarget = {
    kind: target,
    mode,
    host,
    projectId,
    branchId: endpoint.branchId,
    branchName: endpoint.branchName,
  }

  if (target === "branch") {
    if (endpoint.isDefaultBranch) {
      throw new MigrationGuardError(
        "DEFAULT_BRANCH_IN_BRANCH_MODE",
        `${host} is the default (production) branch of project ${projectId}; a rehearsal runs on another branch`
      )
    }
    const allowed = allowedHosts(env.MIGRATION_ALLOWED_TARGET_HOSTS)
    if (!allowed.some((entry) => sameDatabaseHost(entry, host))) {
      throw new MigrationGuardError(
        "HOST_NOT_ALLOWED",
        `${host} is not in MIGRATION_ALLOWED_TARGET_HOSTS`
      )
    }
    return approved
  }

  if (!endpoint.isDefaultBranch) {
    throw new MigrationGuardError(
      "NOT_DEFAULT_BRANCH",
      `--target production needs the default branch of project ${projectId}; ${host} is branch "${endpoint.branchName}"`
    )
  }
  const today = utcDate(deps.now())
  if (env.MIGRATION_CONFIRM_PRODUCTION !== today) {
    throw new MigrationGuardError(
      "PRODUCTION_NOT_CONFIRMED",
      `MIGRATION_CONFIRM_PRODUCTION must be today's date in UTC (${today})`
    )
  }
  const typed = await deps.prompt(
    `This run targets PRODUCTION (${mode}). Type the Neon project id to continue: `
  )
  if (typed.trim() !== projectId) {
    throw new MigrationGuardError(
      "PROJECT_ID_NOT_TYPED",
      "the Neon project id typed does not match NEON_PROJECT_ID"
    )
  }
  return approved
}
