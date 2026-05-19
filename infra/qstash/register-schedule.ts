/**
 * Shared helper for QStash schedule registration.
 *
 * All Eleva QStash schedules follow the same shape:
 *  - POST a publicly-reachable URL on api.eleva.care
 *  - Authenticated via Bearer token (WORKFLOWS_DRAIN_SECRET in most cases)
 *  - 3 retries on failure
 *  - Idempotent re-registration: if a schedule already targets the same
 *    destination URL, delete it first so we end up with exactly one.
 *
 * This module centralises the boilerplate so each per-schedule file can
 * stay tiny and focused on its own cron + path + auth requirements.
 *
 * Per-environment promotion: every script reads `API_BASE_URL`,
 * `QSTASH_TOKEN`, `QSTASH_URL`, and (when applicable)
 * `WORKFLOWS_DRAIN_SECRET` from the active env. Run with the prod
 * `.env` to register prod schedules, with the staging `.env` to
 * register staging schedules. The QStash account is shared across
 * environments today, so destinations distinguish them by URL.
 */
import { Client, type Schedule } from "@upstash/qstash"

export interface ScheduleSpec {
  /** Human-readable label for log output. */
  name: string
  /** Path on the API to POST to (e.g. `/workflows/audit-outbox-drainer`). */
  path: string
  /** Cron expression (UTC). */
  cron: string
  /** Number of retries on non-2xx response. Default 3. */
  retries?: number
  /**
   * Whether the destination route requires a `Bearer ${WORKFLOWS_DRAIN_SECRET}`
   * header. Most workflow drainers do; the WorkOS sync route is the current
   * exception (it relies on a different auth model and accepts unsigned).
   */
  requireBearer?: boolean
  /** Free-text rationale for the schedule, surfaced in logs. */
  description?: string
}

export interface SchedulerOptions {
  dryRun?: boolean
}

export interface SchedulerResult {
  scheduleId: string | null
  destination: string
  action: "dry-run" | "created" | "recreated"
}

function readEnv(name: string, options: { required: boolean }): string | null {
  const value = process.env[name]
  if (!value) {
    if (options.required) {
      console.error(`[qstash] Missing required env var: ${name}`)
      process.exit(1)
    }
    return null
  }
  return value
}

interface ApiBaseUrlResult {
  /** Cleaned URL or a placeholder string for dry-run preview. */
  url: string
  /** True when API_BASE_URL was missing or pointed at localhost. */
  invalid: boolean
}

function readPublicApiBaseUrl(): ApiBaseUrlResult {
  const apiBaseUrl = process.env.API_BASE_URL
  if (
    !apiBaseUrl ||
    apiBaseUrl.includes("localhost") ||
    apiBaseUrl.includes("127.0.0.1")
  ) {
    return { url: "<API_BASE_URL not set>", invalid: true }
  }
  return { url: apiBaseUrl.replace(/\/+$/, ""), invalid: false }
}

function explainMissingApiBaseUrl(): void {
  console.error(
    "\n[qstash] API_BASE_URL must be set to a publicly reachable URL.\n" +
      "  QStash is a cloud service and cannot call localhost.\n\n" +
      "  Examples:\n" +
      "    API_BASE_URL=https://api.eleva.care pnpm qstash:setup           # production\n" +
      "    API_BASE_URL=https://staging-api.eleva.care pnpm qstash:setup   # staging\n" +
      "    pnpm qstash:setup -- --dry-run                                  # preview only (no API_BASE_URL needed)\n"
  )
}

/**
 * Register (or re-register) a single QStash schedule.
 *
 * Idempotent: if any existing schedule already targets the same destination,
 * it is deleted first. This makes the script safe to re-run during
 * promotion (staging → prod) or after a config change.
 *
 * Dry-run is permissive: it prints what WOULD happen even if API_BASE_URL is
 * unset, so an operator can preview the schedule shape before configuring
 * the target environment. Apply mode (the default) requires API_BASE_URL,
 * QSTASH_TOKEN, and (when applicable) WORKFLOWS_DRAIN_SECRET; missing any
 * of these causes the process to exit cleanly with a usage hint.
 */
export async function registerSchedule(
  spec: ScheduleSpec,
  options: SchedulerOptions = {}
): Promise<SchedulerResult> {
  const { dryRun = false } = options
  // QSTASH_TOKEN and WORKFLOWS_DRAIN_SECRET are only mandatory in apply
  // mode. In dry-run we still surface their absence as warnings so the
  // operator notices before hitting "go".
  const token = readEnv("QSTASH_TOKEN", { required: !dryRun })
  const baseUrl = process.env.QSTASH_URL
  const { url: apiBaseUrl, invalid: apiBaseInvalid } = readPublicApiBaseUrl()
  const drainSecret = spec.requireBearer
    ? readEnv("WORKFLOWS_DRAIN_SECRET", { required: !dryRun })
    : null
  const destination = `${apiBaseUrl}${spec.path.startsWith("/") ? "" : "/"}${spec.path}`
  const retries = spec.retries ?? 3

  console.log(`\n[qstash] ${spec.name}`)
  console.log(`  Destination: ${destination}`)
  console.log(`  Cron:        ${spec.cron}`)
  console.log(`  Retries:     ${retries}`)
  console.log(
    `  Bearer:      ${spec.requireBearer ? (drainSecret ? "yes (WORKFLOWS_DRAIN_SECRET)" : "yes (WORKFLOWS_DRAIN_SECRET) - NOT SET") : "no"}`
  )
  if (spec.description) console.log(`  Reason:      ${spec.description}`)
  if (dryRun) console.log(`  Mode:        DRY RUN (no changes)`)

  if (dryRun) {
    if (apiBaseInvalid) {
      console.warn(
        "  Warning:     API_BASE_URL is missing or points at localhost. " +
          "Apply mode would refuse to run."
      )
    }
    return { scheduleId: null, destination, action: "dry-run" }
  }

  // Apply mode: re-validate the inputs we softened for dry-run.
  if (apiBaseInvalid) {
    explainMissingApiBaseUrl()
    process.exit(1)
  }
  if (!token) {
    // readEnv would have already exited, but guard the type narrowing.
    console.error("[qstash] QSTASH_TOKEN missing")
    process.exit(1)
  }

  const client = new Client({ baseUrl, token })
  const existing = await client.schedules.list()
  const matches = existing.filter(
    (s: Schedule) => s.destination === destination
  )
  let action: SchedulerResult["action"] = "created"
  for (const match of matches) {
    console.log(`  Removing existing schedule: ${match.scheduleId}`)
    await client.schedules.delete(match.scheduleId)
    action = "recreated"
  }

  const headers: Record<string, string> = {}
  if (drainSecret) headers.Authorization = `Bearer ${drainSecret}`

  const created = await client.schedules.create({
    destination,
    cron: spec.cron,
    retries,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  })

  console.log(`  Created schedule: ${created.scheduleId}`)
  return { scheduleId: created.scheduleId, destination, action }
}

export function isDryRun(): boolean {
  return process.argv.includes("--dry-run")
}
