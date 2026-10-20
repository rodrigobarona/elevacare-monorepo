import { notifyDueFollowUps } from "@eleva/crm"
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
 * POST /workflows/crm-follow-up-due
 *
 * Hourly: in-app digest of open follow-ups due for their author.
 * Count only — no member names or notes. Authz: Bearer
 * `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => notifyDueFollowUps())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
