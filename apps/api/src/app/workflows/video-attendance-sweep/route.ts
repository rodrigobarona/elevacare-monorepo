import { sweepEndedSessionsWithoutAttendance } from "@eleva/workflows/video"
import type { RoutePolicy } from "@/lib/route-policy"
import {
  internalWorkflowOptions,
  runInternalWorkflow,
} from "@/lib/internal-workflow"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/video-attendance-sweep
 *
 * Every 10 minutes: sessions still `scheduled`/`live`/`room_unresolved`
 * with null attendance whose Eleva join window (`endsAt + 30m`) has
 * closed get `finalizeAttendance` from participant history (empty
 * history → nobody / no_show). This is where every no-show is declared,
 * and where a session whose room emptied before its booked end is closed:
 * Daily's `meeting.ended` only closes a session that happened, after its
 * booked end (`afterMeetingEnded`).
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () =>
    sweepEndedSessionsWithoutAttendance()
  )
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
