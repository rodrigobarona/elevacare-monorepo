import { sweepExpiredAiDrafts } from "@eleva/compliance"
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
 * Daily: delete unpublished AI drafts untouched for 90 days (one audit
 * event per org). Batched; `hasMore` means the next run continues.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => sweepExpiredAiDrafts())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
