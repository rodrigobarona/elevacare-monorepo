import { runRetentionSweep } from "@eleva/compliance"
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
 * POST /workflows/retention-sweep
 *
 * Daily: purge expired AI drafts (90d), session documents (Blob then row),
 * and notification delivery logs (1y). Batched; `hasMore` schedules another run.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => runRetentionSweep())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
