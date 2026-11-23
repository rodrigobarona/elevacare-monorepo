import { processPendingPayouts } from "@eleva/workflows/payments"
import type { RoutePolicy } from "@/lib/route-policy"
import {
  internalWorkflowOptions,
  runInternalWorkflow,
} from "@/lib/internal-workflow"
import { reportedJob } from "@/lib/reported-job"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const POST = reportedJob(
  "process-pending-payouts",
  async (request: Request) => {
    return runInternalWorkflow(request, async () => processPendingPayouts())
  }
)

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
