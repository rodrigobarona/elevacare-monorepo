import { logError } from "@eleva/observability"
import { nextReservationExpiry } from "@eleva/scheduling"
import {
  expireStaleReservations,
  SLOT_RESERVATION_EXPIRY_BATCH_SIZE,
  type SlotExpiryResult,
} from "@eleva/workflows/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"
import {
  internalWorkflowOptions,
  runInternalWorkflow,
} from "@/lib/internal-workflow"
import { reportedJob } from "@/lib/reported-job"
import { runJobAgain, runJobAt, whichRun } from "@/lib/run-job-at"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/slot-reservation-expiry
 *
 * When a hold lapses (one delayed run each, asked for by the reserve
 * route and by this job itself) and in the hourly tick as the net
 * underneath: expire lapsed slot holds, cancelling still-cancelable
 * PaymentIntents first and keeping holds whose intent can still settle
 * (MB WAY `processing`).
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const POST = reportedJob(
  "slot-reservation-expiry",
  async (request: Request) => {
    return runInternalWorkflow(request, async () => {
      const result = await expireStaleReservations()
      await comeBackForHolds(result, await whichRun(request))
      return result
    })
  }
)

/**
 * This job runs hourly, and a hold lasts five minutes. So it asks to be
 * run again when the next hold lapses (the reserve route asks for the
 * first run), and once more soon when a hold could not be dealt with.
 * Nothing here can fail the run: the hourly tick is underneath.
 */
async function comeBackForHolds(
  result: SlotExpiryResult,
  run: { again: number; fromTick: boolean }
): Promise<void> {
  try {
    const dealtWith = result.expired + result.kept + result.retried
    if (result.scanned >= SLOT_RESERVATION_EXPIRY_BATCH_SIZE && dealtWith > 0) {
      // A full batch is not a failure: more are waiting, now. Only when
      // this one got somewhere: a batch that all failed would be the
      // same batch again, every half minute.
      await runJobAt("slot-reservation-expiry", new Date())
    } else if (result.errors > 0 && !run.fromTick) {
      // Not after the tick's own run: a hold that cannot be dealt with
      // at all would otherwise start these runs again every hour.
      await runJobAgain("slot-reservation-expiry", run.again)
    }
    const next = await nextReservationExpiry()
    if (next) await runJobAt("slot-reservation-expiry", next)
  } catch (err) {
    logError("[slot-reservation-expiry] the next run was not asked for", err)
  }
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
