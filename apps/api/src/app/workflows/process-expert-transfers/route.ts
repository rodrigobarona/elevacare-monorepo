import { processExpertTransfers } from "@eleva/workflows/payments"
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
  "process-expert-transfers",
  async (request: Request) => {
    return runInternalWorkflow(request, async () => processExpertTransfers())
  }
)

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
