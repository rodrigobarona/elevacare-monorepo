import { logError } from "@eleva/observability"
import { publishPendingDomainEvents } from "@eleva/workflows/domain-events"
import { defaultDomainEventSubscribers } from "@eleva/workflows/subscribers"
import { afterResponse } from "./after-response"
import { runJobAgain, runJobAt } from "./run-job-at"

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

/** What several passes did, added up. */
export type Published = {
  claimed: number
  succeeded: number
  failed: number
  dead: number
  /** The last pass came back full: more is waiting. */
  more: boolean
}

/**
 * Passes over the outbox until one comes back less than full, or
 * `mostPasses` were made. `keepGoing` lets a caller ask for one more
 * pass (see below).
 */
export async function publishPasses(
  mostPasses: number,
  keepGoing: () => boolean = () => false
): Promise<Published> {
  const total: Published = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    more: false,
  }
  for (let pass = 0; pass < mostPasses; pass += 1) {
    const result = await publishPendingDomainEvents({
      subscribers: defaultDomainEventSubscribers(),
      batchSize: BATCH,
    })
    total.claimed += result.claimed
    total.succeeded += result.succeeded
    total.failed += result.failed
    total.dead += result.dead
    // Asked once a pass: asking takes the answer away.
    const asked = keepGoing()
    total.more = result.claimed >= BATCH || asked
    if (!total.more) return total
  }
  // Out of passes with a full batch or a caller still asking: something
  // is left, and `more` says so.
  return total
}

/** After a request: a few passes, and the job takes over from there. */
const PASSES_AFTER_A_REQUEST = 4

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
    // A call made while this was finishing (asking the job to go on, or
    // failing) was told "one more pass" and has not had it.
    if (askedAgain) {
      askedAgain = false
      void publishDomainEventsNow()
    }
  })
  return running
}

async function publish(): Promise<void> {
  try {
    const result = await publishPasses(PASSES_AFTER_A_REQUEST, () => {
      const asked = askedAgain
      askedAgain = false
      return asked
    })
    if (result.failed > 0 || result.dead > 0) {
      console.error("[domain-events] deliveries failed", result)
    }
    // More than a request should carry: the job goes on from here, now.
    if (result.more) await runJobAt("domain-events-publisher", new Date())
    // A delivery that failed is tried again by the job, soon: a
    // confirmation email does not wait for the next hour.
    else if (result.failed > 0) await runJobAgain("domain-events-publisher", 0)
  } catch (err) {
    logError("[domain-events] publishing after the request failed", err)
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
