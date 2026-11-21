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
  | "URL_PARAMETER_NOT_ALLOWED"
  | "TARGET_NOT_NEON"
  | "SOURCE_URL_MISSING"
  | "SOURCE_IS_TARGET"
  | "SOURCE_IN_TARGET_PROJECT"
  | "NEON_PROJECT_MISSING"
  | "NEON_LOOKUP_FAILED"
  | "ENDPOINT_NOT_IN_PROJECT"
  | "ENDPOINT_NOT_WRITABLE"
  | "BRANCH_UNKNOWN"
  | "DEFAULT_BRANCH_IN_BRANCH_MODE"
  | "HOST_NOT_ALLOWED"
  | "NOT_DEFAULT_BRANCH"
  | "PRODUCTION_NOT_CONFIRMED"
  | "PRODUCTION_NOT_INTERACTIVE"
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
  /** A person is at the terminal (stdin is a TTY), not a pipe or a CI job. */
  isInteractive: () => boolean
  now: () => Date
}

export interface ApprovedMigrationTarget {
  kind: MigrationTargetKind
  mode: MigrationMode
  host: string
  projectId: string
  branchId: string
  branchName: string
  /**
   * The only connection strings a run may use. They are rebuilt from the
   * parts the guard checked, so nothing in the original URL (a `host` or
   * `options` parameter, a second host) can send the driver elsewhere.
   * They carry credentials: never log them.
   */
  targetUrl: string
  sourceUrl: string
}

/** Parameters a connection URL may carry. Everything else is refused. */
const ALLOWED_URL_PARAMETERS = new Set(["sslmode", "channel_binding"])

interface CheckedUrl {
  host: string
  /** Rebuilt from the checked parts only. */
  url: string
}

/**
 * Reads a Postgres connection URL and rebuilds it from the parts that were
 * checked. A driver also honours `host`, `hostaddr`, `port` and `options`
 * given as query parameters, which would move the connection away from the
 * host in the URL, so any parameter outside the short allowlist is refused.
 */
function checkedUrl(
  url: string | undefined,
  missing: MigrationGuardErrorCode,
  name: string
): CheckedUrl {
  if (!url?.trim()) {
    throw new MigrationGuardError(missing, `${name} is not set`)
  }
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new MigrationGuardError(
      "TARGET_URL_INVALID",
      `${name} is not a valid connection URL`
    )
  }
  const host = parsed.hostname.toLowerCase()
  if (
    !/^postgres(ql)?:$/.test(parsed.protocol) ||
    !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host) ||
    (parsed.port !== "" && parsed.port !== "5432") ||
    parsed.hash !== ""
  ) {
    throw new MigrationGuardError(
      "TARGET_URL_INVALID",
      `${name} is not a plain Postgres connection URL (one host, default port)`
    )
  }
  const parameters = new URLSearchParams()
  for (const [key, value] of parsed.searchParams) {
    if (!ALLOWED_URL_PARAMETERS.has(key)) {
      throw new MigrationGuardError(
        "URL_PARAMETER_NOT_ALLOWED",
        `${name} carries the parameter "${key}"; only ${[...ALLOWED_URL_PARAMETERS].join(" and ")} are allowed`
      )
    }
    parameters.set(key, value)
  }
  const rebuilt = new URL(`postgresql://${host}`)
  rebuilt.username = parsed.username
  rebuilt.password = parsed.password
  rebuilt.pathname = parsed.pathname
  rebuilt.search = parameters.toString()
  return { host, url: rebuilt.toString() }
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
  const checkedTarget = checkedUrl(
    env.TARGET_DATABASE_URL,
    "TARGET_URL_MISSING",
    "TARGET_DATABASE_URL"
  )
  const host = checkedTarget.host
  if (!host.endsWith(".neon.tech")) {
    throw new MigrationGuardError(
      "TARGET_NOT_NEON",
      `the target host ${host} is not a Neon endpoint`
    )
  }
  const checkedSource = checkedUrl(
    env.MVP_DATABASE_URL,
    "SOURCE_URL_MISSING",
    "MVP_DATABASE_URL"
  )
  const sourceHost = checkedSource.host
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

  // Neon is asked through one door, so a failed or unreadable answer is a
  // refusal like any other, never a crash that skips the checks below.
  const lookup = async (name: string) => {
    try {
      return await deps.resolveEndpoint(name)
    } catch (err) {
      throw new MigrationGuardError(
        "NEON_LOOKUP_FAILED",
        `Neon could not be asked about ${name}: ${err instanceof Error ? err.message : "unknown error"}`
      )
    }
  }
  // The MVP lives in another project: a "source" inside the v3 production
  // project is a v3 database given by mistake.
  if (await lookup(sourceHost)) {
    throw new MigrationGuardError(
      "SOURCE_IN_TARGET_PROJECT",
      `MVP_DATABASE_URL points to an endpoint of Neon project ${projectId}, the v3 project`
    )
  }
  const endpoint = await lookup(host)
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
    targetUrl: checkedTarget.url,
    sourceUrl: checkedSource.url,
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
  if (!deps.isInteractive()) {
    throw new MigrationGuardError(
      "PRODUCTION_NOT_INTERACTIVE",
      "--target production needs a person at the terminal to type the Neon project id"
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
