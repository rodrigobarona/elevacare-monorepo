import type { JobsInTick } from "@eleva/config/background-jobs"
import { logError } from "@eleva/observability"
import { publishWorkflowJob } from "./qstash-publish"

/**
 * Running a job of the hourly tick at the moment it is needed.
 *
 * The tick is hourly so that the database can sleep (see
 * `@eleva/config/background-jobs`). Some work cannot wait an hour: a hold
 * that lapses in five minutes, a person removed from a call whose removal
 * did not go through. For those, one delayed message runs the job when
 * the work falls due. The job is the same one the tick runs: it looks at
 * what is due and does that, so a message that arrives early, late or
 * twice does no harm, and one that never arrives is caught by the tick.
 *
 * Nothing here throws: this is always an extra, said after the work
 * itself was done.
 */
type TickJob = JobsInTick<"hourly">

/** Runs are grouped to this many seconds, so many items due together send one message. */
const GROUP_SECONDS = 30

/** A moment already here is "in a few seconds": the caller may still be writing. */
const SOONEST_MS = 5_000

/**
 * Asks for one run of `job` at `at` (or a little after). Without a queue
 * (on a laptop) nothing is sent, and the job runs when someone runs it.
 */
export async function runJobAt(
  job: TickJob,
  at: Date,
  body: Record<string, unknown> = {},
  now: Date = new Date()
): Promise<void> {
  const soonest = now.getTime() + SOONEST_MS
  const seconds = Math.ceil(Math.max(at.getTime(), soonest) / 1000)
  const grouped = Math.ceil(seconds / GROUP_SECONDS) * GROUP_SECONDS
  try {
    await publishWorkflowJob(`/workflows/${job}`, body, {
      notBefore: new Date(grouped * 1000),
      deduplicationId: `${job}:${grouped}`,
    })
  } catch (err) {
    logError(`[run-job-at] ${job} was not scheduled`, err)
  }
}

/**
 * How long after a run that left work undone the next run comes: the
 * first soon, then further apart, then no more: the hourly tick takes
 * over. Kept short on purpose: every step is a message and a waking of
 * the database.
 */
const AGAIN_AFTER_SECONDS = [90, 300, 900] as const

/** Which of those runs a request is: 0 for the tick or a first run. */
export async function againNumber(request: Request): Promise<number> {
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { again?: unknown } | null
  const again = body?.again
  return typeof again === "number" && Number.isInteger(again) && again > 0
    ? again
    : 0
}

/**
 * After a run of `job` that left work undone (a provider was down), asks
 * for another. `after` is the number of the run that just ended; past
 * the last step nothing is asked, and it says so.
 */
export async function runJobAgain(
  job: TickJob,
  after: number,
  now: Date = new Date()
): Promise<"asked" | "left to the tick"> {
  const wait = AGAIN_AFTER_SECONDS[after]
  if (wait === undefined) return "left to the tick"
  await runJobAt(
    job,
    new Date(now.getTime() + wait * 1000),
    { again: after + 1 },
    now
  )
  return "asked"
}
