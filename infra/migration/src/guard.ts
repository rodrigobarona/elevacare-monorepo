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
 * Every refusal is a `MigrationGuardError`; a command built on the guard
 * exits 2 on one.
 */

export type MigrationGuardErrorCode =
  | "TARGET_URL_MISSING"
  | "TARGET_URL_INVALID"
  | "SOURCE_URL_INVALID"
  | "URL_PARAMETER_VALUE_NOT_ALLOWED"
  | "URL_PASSWORD_NAMES_ENDPOINT"
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

/**
 * Parameters a connection URL may carry, each with the values that keep the
 * connection encrypted and verified. Everything else is refused.
 */
const ALLOWED_URL_PARAMETERS: Record<string, readonly string[]> = {
  sslmode: ["require", "verify-full"],
  channel_binding: ["require", "prefer"],
}

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
  invalid: MigrationGuardErrorCode,
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
      invalid,
      `${name} is not a valid connection URL. It has the form postgresql://user:password@host/database?sslmode=require; a password with special characters must be percent-encoded`
    )
  }
  const host = parsed.hostname.toLowerCase()
  if (
    !/^postgres(ql)?:$/.test(parsed.protocol) ||
    !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host) ||
    (parsed.port !== "" && parsed.port !== "5432") ||
    parsed.hash !== ""
  ) {
    // The host is not printed: a password with an unencoded "@" or "?"
    // shifts the parse, and part of it would land in the message.
    throw new MigrationGuardError(
      invalid,
      `${name} is not a plain Postgres connection URL. Use one host, the default port and no fragment, and percent-encode special characters in the password`
    )
  }
  const allowedNames = Object.keys(ALLOWED_URL_PARAMETERS).join(" and ")
  const parameters = new URLSearchParams()
  for (const [key, value] of parsed.searchParams) {
    const values = Object.hasOwn(ALLOWED_URL_PARAMETERS, key)
      ? ALLOWED_URL_PARAMETERS[key]
      : undefined
    // Neither the name nor the value is printed: an unencoded "?" in the
    // password turns the rest of it into "parameters".
    if (!values) {
      throw new MigrationGuardError(
        "URL_PARAMETER_NOT_ALLOWED",
        `${name} carries a parameter other than ${allowedNames}. Remove it from the URL: a driver would follow host, port or options to another database`
      )
    }
    if (parameters.has(key) || !values.includes(value)) {
      throw new MigrationGuardError(
        "URL_PARAMETER_VALUE_NOT_ALLOWED",
        `${name} must carry ${key} once, set to ${values.join(" or ")}, so the connection stays encrypted`
      )
    }
    parameters.set(key, value)
  }
  // Neon reads "endpoint=…" or "project=…" at the start of a password as the
  // endpoint to connect to, whatever the host says.
  if (/^(endpoint|project)=/i.test(decodeURIComponent(parsed.password))) {
    throw new MigrationGuardError(
      "URL_PASSWORD_NAMES_ENDPOINT",
      `the password in ${name} starts with "endpoint=" or "project=", which Neon reads as the endpoint to connect to. Use the plain password`
    )
  }
  const rebuilt = new URL(`postgresql://${host}`)
  rebuilt.username = parsed.username
  rebuilt.password = parsed.password
  rebuilt.pathname = parsed.pathname
  rebuilt.search = parameters.toString()
  return { host, url: rebuilt.toString() }
}

/** `ep-name-123-pooler.region.aws.neon.tech` as its direct host. */
export function directHost(host: string): string {
  return host.toLowerCase().replace(/^([^.]+)-pooler\./, "$1.")
}

/** A pooled host and its direct host are one database. */
function sameDatabaseHost(a: string, b: string): boolean {
  return directHost(a) === directHost(b)
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
    "TARGET_URL_INVALID",
    "TARGET_DATABASE_URL"
  )
  const host = checkedTarget.host
  if (!host.endsWith(".neon.tech")) {
    throw new MigrationGuardError(
      "TARGET_NOT_NEON",
      `the target host ${host} is not a Neon endpoint (its name must end in .neon.tech)`
    )
  }
  const checkedSource = checkedUrl(
    env.MVP_DATABASE_URL,
    "SOURCE_URL_MISSING",
    "SOURCE_URL_INVALID",
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
        `could not ask Neon about ${name} (${err instanceof Error ? err.message : "unknown error"}). Check NEON_API_KEY and NEON_PROJECT_ID, then run again`
      )
    }
  }
  // The MVP lives in another project: a "source" inside the v3 production
  // project is a v3 database given by mistake.
  if (await lookup(sourceHost)) {
    throw new MigrationGuardError(
      "SOURCE_IN_TARGET_PROJECT",
      `MVP_DATABASE_URL points to an endpoint of Neon project ${projectId}, which is the v3 project. Set it to the MVP database`
    )
  }
  const endpoint = await lookup(host)
  if (!endpoint || endpoint.projectId !== projectId) {
    throw new MigrationGuardError(
      "ENDPOINT_NOT_IN_PROJECT",
      `the target host ${host} is not an endpoint of Neon project ${projectId}. Check TARGET_DATABASE_URL and NEON_PROJECT_ID`
    )
  }
  if (!endpoint.isReadWrite) {
    throw new MigrationGuardError(
      "ENDPOINT_NOT_WRITABLE",
      `the target host ${host} is a read replica. Use the read-write endpoint of the same branch`
    )
  }
  if (!endpoint.branchId || typeof endpoint.isDefaultBranch !== "boolean") {
    throw new MigrationGuardError(
      "BRANCH_UNKNOWN",
      `Neon did not say which branch ${host} belongs to, so the run stops. Run again; if it repeats, check the endpoint in the Neon console`
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
        `${host} is not in MIGRATION_ALLOWED_TARGET_HOSTS. Add the rehearsal branch's host to it`
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
      `MIGRATION_CONFIRM_PRODUCTION is ${env.MIGRATION_CONFIRM_PRODUCTION ? "set to another day" : "not set"}; it must be today's date in UTC (${today})`
    )
  }
  if (!deps.isInteractive()) {
    throw new MigrationGuardError(
      "PRODUCTION_NOT_INTERACTIVE",
      "--target production needs a person at the terminal to type the Neon project id"
    )
  }
  const typed = await deps.prompt(
    `This run targets PRODUCTION: branch "${endpoint.branchName}" on ${host} (${mode}), reading from ${sourceHost}. Type the Neon project id to continue: `
  )
  if (typed.trim() !== projectId) {
    throw new MigrationGuardError(
      "PROJECT_ID_NOT_TYPED",
      "the Neon project id typed does not match NEON_PROJECT_ID. Nothing was run"
    )
  }
  return approved
}
