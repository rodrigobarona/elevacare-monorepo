import { logError } from "@eleva/observability"
import { publishPendingDomainEvents } from "@eleva/workflows/domain-events"
import { defaultDomainEventSubscribers } from "@eleva/workflows/subscribers"
import { afterResponse } from "./after-response"
import { runJobAgain } from "./run-job-at"

/**
 * Publishing events when they are written, not when a clock says so.
 *
 * An event in the outbox becomes an email, a calendar entry, a call room.
 * The job that publishes the outbox runs once an hour, so that the
 * database can sleep (see `@eleva/config/background-jobs`). So the
 * request that writes an event publishes it too, once it has answered:
 * the database is awake then anyway.
 *
 * `instrumentation.ts` makes `publishDomainEventsAfterResponse` what
 * happens whenever an event is written (`onDomainEventWritten`).
 */

/** How many deliveries one pass takes; a full pass means more may wait. */
const BATCH = 25

/** A stop for the loop below: a pass that keeps filling is the job's work. */
const MOST_PASSES = 4

let running: Promise<void> | null = null
let askedAgain = false

/**
 * Publishes what is in the outbox now. One at a time in this server: a
 * call made while one runs is answered by one more pass after it, since
 * its events may have been written after that pass looked. Never throws.
 */
export function publishDomainEventsNow(): Promise<void> {
  if (running) {
    askedAgain = true
    return running
  }
  running = publish().finally(() => {
    running = null
  })
  return running
}

async function publish(): Promise<void> {
  for (let pass = 0; pass < MOST_PASSES; pass += 1) {
    askedAgain = false
    let full: boolean
    try {
      const result = await publishPendingDomainEvents({
        subscribers: defaultDomainEventSubscribers(),
        batchSize: BATCH,
      })
      full = result.claimed >= BATCH
      if (result.failed > 0 || result.dead > 0) {
        console.error("[domain-events] deliveries failed", result)
      }
      // A delivery that failed is tried again by the job, soon: a
      // confirmation email does not wait for the next hour.
      if (result.failed > 0) await runJobAgain("domain-events-publisher", 0)
    } catch (err) {
      logError("[domain-events] publishing after the request failed", err)
      return
    }
    if (!full && !askedAgain) return
  }
}

/**
 * What the API does when an event is written: publish once the request
 * has been answered (and so after its transaction has ended). Outside a
 * request there is nothing to wait for and nobody to tell: the hourly
 * run publishes.
 */
export function publishDomainEventsAfterResponse(): void {
  afterResponse(publishDomainEventsNow)
}
