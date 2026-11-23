import { z } from "zod"
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
 * What a job's route is sent: which run after a failure this is, and
 * whether the tick sent it. Both are optional. A body that does not
 * read as this is a first run, not from the tick.
 */
export const JobRunSchema = z.object({
  again: z.number().int().min(1).max(50).optional(),
  tick: z.literal(true).optional(),
})

/** Which run this is: 0 for a first run, and whether the hourly tick sent it. */
export async function whichRun(
  request: Request
): Promise<{ again: number; fromTick: boolean }> {
  const parsed = JobRunSchema.safeParse(
    await request
      .clone()
      .json()
      .catch(() => null)
  )
  return {
    again: parsed.success ? (parsed.data.again ?? 0) : 0,
    fromTick: parsed.success ? parsed.data.tick === true : false,
  }
}

let saidNoQueue = false

/**
 * Asks for one run of `job` at `at` (or a little after). Without a queue
 * (on a laptop) nothing is sent, and the job runs when someone runs it.
 */
export async function runJobAt(
  job: TickJob,
  at: Date,
  body: { again?: number } = {},
  now: Date = new Date()
): Promise<void> {
  const soonest = now.getTime() + SOONEST_MS
  const seconds = Math.ceil(Math.max(at.getTime(), soonest) / 1000)
  const grouped = Math.ceil(seconds / GROUP_SECONDS) * GROUP_SECONDS
  try {
    const sent = await publishWorkflowJob(`/workflows/${job}`, body, {
      notBefore: new Date(grouped * 1000),
      // Per job, per moment, and per step of a ladder: a first run and a
      // later step that fall in the same half minute are two messages.
      deduplicationId: `${job}:${grouped}:${body.again ?? 0}`,
    })
    // Deployed with no queue set up, every one of these is lost and the
    // work waits for the hour. Said once, so that it is not found late.
    if (sent === "inline" && process.env.VERCEL_ENV && !saidNoQueue) {
      saidNoQueue = true
      logError(
        "[run-job-at] no queue is set up here: jobs run hourly only",
        new Error("QSTASH_TOKEN, WORKFLOWS_DRAIN_SECRET or API_URL is missing")
      )
    }
  } catch (err) {
    logError(`[run-job-at] ${job} was not scheduled`, err)
  }
}

/**
 * How long after a run that left work undone the next run comes: soon,
 * then further apart, then no more, and the hourly tick takes over. Each
 * step is a message and a waking of the database, so a job gets the
 * steps its work is worth.
 *
 * Putting a person out of a call they were removed from is worth the
 * most: about every minute at first, and no gap over ten minutes for the
 * whole hour until the tick. For that job the tick starts the steps
 * again, so they go on for as long as someone is still to be put out.
 */
const AGAIN_AFTER_SECONDS = {
  default: [90, 300, 900],
  "video-eject-retry": [60, 60, 120, 120, 300, 300, 600, 600, 600, 600],
} as const satisfies { default: readonly number[] } & {
  [Job in TickJob]?: readonly number[]
}

/** The steps of one job, as seconds to wait after each run. */
export function againSteps(job: TickJob): readonly number[] {
  return job in AGAIN_AFTER_SECONDS
    ? AGAIN_AFTER_SECONDS[job as keyof typeof AGAIN_AFTER_SECONDS]
    : AGAIN_AFTER_SECONDS.default
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
  const wait = againSteps(job)[after]
  if (wait === undefined) return "left to the tick"
  await runJobAt(
    job,
    new Date(now.getTime() + wait * 1000),
    { again: after + 1 },
    now
  )
  return "asked"
}
