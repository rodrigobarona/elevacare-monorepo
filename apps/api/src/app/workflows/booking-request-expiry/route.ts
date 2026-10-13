import { expireBookingRequests } from "@eleva/scheduling"
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
 * POST /workflows/booking-request-expiry
 *
 * Every minute: expire awaiting_confirmation bookings past
 * approval_deadline_at (24h or session start). Full refund + slot release.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => expireBookingRequests())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
