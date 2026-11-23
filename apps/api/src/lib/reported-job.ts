import type { BackgroundJobName } from "@eleva/config/background-jobs"
import { reportJobRun, type JobFailure } from "@eleva/observability"

/**
 * Wraps a job's route handler so that every run reports how it ended
 * (`@eleva/observability` `reportJobRun`). Every route under `/workflows`
 * and `/cron` exports its handler through this; a test fails when one
 * does not.
 *
 * What the handler answers decides what is reported:
 * - 2xx: the job ran to its end. Reported as done, also when it had
 *   nothing to do.
 * - 5xx, or a throw: the job failed. Reported as failed, with the status
 *   and nothing else. A throw is passed on as it was.
 * - anything else (401, 422, 429): the caller was refused before the job
 *   began. Nothing is reported, so a stranger cannot make a job look
 *   alive or look broken. One exception: when the server's own secret for
 *   these routes is missing, every call answers 500 before it is checked.
 *   The job cannot run at all then, and it is reported as failed.
 *
 * A failed attempt is reported each time, also one that QStash will retry:
 * the alert is early, and the retry that succeeds clears it.
 *
 * The report is awaited before the answer is returned, so the platform
 * cannot cut it off. Nobody waits on these answers; the cost is at most
 * eight seconds on a run where the monitor is down, and sixteen for a
 * tick, which reports for itself after its jobs have.
 */
export function reportedJob<Args extends unknown[]>(
  job: BackgroundJobName,
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    let response: Response
    try {
      response = await handler(...args)
    } catch (err) {
      await reportJobRun(job, "fail", "threw")
      throw err
    }
    const failure = jobFailure(response.status)
    if (failure) {
      await reportJobRun(job, "fail", failure)
    } else if (response.ok) {
      await reportJobRun(job, "ok")
    }
    return response
  }
}

function jobFailure(status: number): JobFailure | null {
  return status >= 500 ? `status ${status}` : null
}
