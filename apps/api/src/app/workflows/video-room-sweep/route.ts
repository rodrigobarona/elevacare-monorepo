import { sweepMissingSessionRooms } from "@eleva/workflows/video"
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
 * POST /workflows/video-room-sweep
 *
 * Every 15 minutes: create Daily rooms for confirmed/rescheduled online
 * bookings that start within 2 hours and still have no room name.
 * Phone and in-person bookings are excluded by the sweep query.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => sweepMissingSessionRooms())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
