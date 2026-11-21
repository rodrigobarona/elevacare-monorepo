import { sweepPendingSeatSyncs } from "@eleva/billing/server"
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
 * POST /workflows/seat-sync-sweep
 *
 * Every ten minutes: finish clinic seat syncs that were marked but never
 * reached Stripe (after a publish, an unpublish, a deleted service or a
 * removed member), so the billed seat count catches up on its own.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => ({
    ...(await sweepPendingSeatSyncs()),
  }))
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
