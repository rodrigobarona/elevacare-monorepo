import { expireStaleReservations } from "@eleva/workflows/scheduling"
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
 * POST /workflows/slot-reservation-expiry
 *
 * Every minute: expire lapsed slot holds, cancelling still-cancelable
 * PaymentIntents first and keeping holds whose intent can still settle
 * (MB WAY `processing`).
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => expireStaleReservations())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
