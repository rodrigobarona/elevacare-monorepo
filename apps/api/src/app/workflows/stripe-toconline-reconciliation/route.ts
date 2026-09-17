import { SaftMonthSchema } from "@eleva/api-client"
import { processStripeToconlineReconciliation } from "@eleva/workflows/invoicing"
import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import {
  internalWorkflowOptions,
  runInternalWorkflow,
} from "@/lib/internal-workflow"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/stripe-toconline-reconciliation
 *
 * Monthly comparison of Stripe booking payments vs expert_invoices.
 * Does not POST TOConline commercial sales documents. Optional JSON
 * `{ "month": "YYYY-MM" }` reruns a specific Lisbon calendar month;
 * the QStash schedule compares the previous month.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z
  .object({
    month: SaftMonthSchema.optional(),
  })
  .strict()

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const raw = await request.text()
  let json: unknown = {}
  if (raw.trim() !== "") {
    try {
      json = JSON.parse(raw) as unknown
    } catch {
      return secureJson(
        { error: "validation", message: "invalid json" },
        { status: 422, headers }
      )
    }
  }
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }
  return runInternalWorkflow(request, async () =>
    processStripeToconlineReconciliation({ month: parsed.data.month })
  )
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
