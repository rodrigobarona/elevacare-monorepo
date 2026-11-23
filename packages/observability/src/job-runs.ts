import {
  isScheduledJob,
  type BackgroundJobName,
  type ScheduledJobName,
} from "@eleva/config/background-jobs"

/**
 * Says that a background job ran, to the monitor that expects it.
 *
 * Each scheduled job has its own heartbeat in Better Stack, with its own
 * secret address. A job that finished requests its address; one that
 * failed requests it with `/fail`; one that never ran requests nothing,
 * and the monitor raises the alert when the run is late. The addresses
 * come from `BETTERSTACK_HEARTBEAT_URLS`, a JSON object of job name to
 * address. A job with no address reports nothing, so this is safe with no
 * monitoring account at all.
 *
 * Reporting never changes what a job does: it has a time limit, it never
 * throws, and what goes wrong is logged without the address, which is a
 * secret. It keeps no state, so a run delivered twice or retried just
 * reports again, and a success after a failure clears it.
 */

export type JobOutcome = "ok" | "fail"

/** Why a run failed, in a form that can hold no personal data. */
export type JobFailure = "threw" | `status ${number}`

const ATTEMPTS = 2
const ATTEMPT_TIMEOUT_MS = 4000

let parsedFrom: string | undefined
let parsed: Partial<Record<ScheduledJobName, string>> = {}

/** The addresses in the setting, read once for each value it takes. */
function heartbeatUrls(): Partial<Record<ScheduledJobName, string>> {
  const raw = process.env.BETTERSTACK_HEARTBEAT_URLS?.trim() ?? ""
  if (raw === parsedFrom) return parsed
  parsedFrom = raw
  parsed = {}
  if (raw === "") return parsed

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    value = null
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    console.error(
      "[job-runs] BETTERSTACK_HEARTBEAT_URLS is not a JSON object of job name to address; no job reports"
    )
    return parsed
  }
  for (const [name, url] of Object.entries(value)) {
    if (!isScheduledJob(name)) {
      console.error(
        `[job-runs] BETTERSTACK_HEARTBEAT_URLS names "${name}", which is not a scheduled job; it is ignored`
      )
      continue
    }
    if (typeof url !== "string" || !isHttpsUrl(url)) {
      console.error(
        `[job-runs] the address for "${name}" in BETTERSTACK_HEARTBEAT_URLS is not an https address; that job does not report`
      )
      continue
    }
    parsed[name] = url.replace(/\/+$/, "")
  }
  return parsed
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

async function request(url: string, body: string | undefined) {
  return fetch(url, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
  })
}

/**
 * Report one run. Resolves when the monitor has it, or when it could not
 * be told; never rejects.
 */
export async function reportJobRun(
  job: BackgroundJobName,
  outcome: JobOutcome,
  failure?: JobFailure
): Promise<void> {
  try {
    if (!isScheduledJob(job)) return
    const base = heartbeatUrls()[job]
    if (!base) return
    const url = outcome === "ok" ? base : `${base}/fail`
    const body = outcome === "ok" ? undefined : (failure ?? "failed")

    // A second try: a lost report from a daily job is a false alarm a day
    // later. Two tries of four seconds stay under ten in all.
    let problem = ""
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      try {
        const response = await request(url, body)
        if (response.ok) return
        problem = `the monitor answered ${response.status}`
        // A wrong address stays wrong: do not ask again.
        if (response.status < 500) break
      } catch (err) {
        problem =
          err instanceof Error && err.name === "TimeoutError"
            ? "the monitor did not answer in time"
            : "the monitor could not be reached"
      }
    }
    console.error(`[job-runs] "${job}" could not report ${outcome}: ${problem}`)
  } catch {
    // Reporting must never be the reason a job fails.
  }
}
