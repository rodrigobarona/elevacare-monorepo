import { processInvoicingRetry } from "@eleva/workflows/invoicing"
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
 * POST /workflows/invoicing-retry
 *
 * Slow-stage retry for failed expert invoices (every 30 minutes).
 * Re-dispatches through `issueExpertServiceInvoice`; the TOConline v1
 * issuance gate stays closed, so retries record skip/blocked and never
 * POST commercial sales documents.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  return runInternalWorkflow(request, async () => processInvoicingRetry())
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
