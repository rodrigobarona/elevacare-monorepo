import { retryPendingEjects } from "@eleva/workflows/video"
import type { RoutePolicy } from "@/lib/route-policy"
import {
  internalWorkflowOptions,
  runInternalWorkflow,
} from "@/lib/internal-workflow"
import { reportedJob } from "@/lib/reported-job"
import { runJobAgain, whichRun } from "@/lib/run-job-at"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/video-eject-retry
 *
 * Completes Daily ejects for revoked delegates that still have no
 * ejected_at. Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const POST = reportedJob(
  "video-eject-retry",
  async (request: Request) => {
    return runInternalWorkflow(request, async () => {
      const result = await retryPendingEjects()
      // Someone removed from a call is still in it, or a room is still
      // too small for someone added: not something to leave for an hour.
      // After the tick's run too (it counts as a first run), so the
      // tries go on for as long as someone is still to be put out. It
      // ends: a room that is gone counts as done.
      if (result.pending > 0 || result.capacity.pending > 0) {
        const { again } = await whichRun(request)
        await runJobAgain("video-eject-retry", again)
      }
      return result
    })
  }
)

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
