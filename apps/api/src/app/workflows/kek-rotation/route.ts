import { KekRotationWorkflowRequestSchema } from "@eleva/api-client"
import { rotateAllOrgKeks } from "@eleva/encryption"
import { corsHeaders } from "@/lib/cors"
import {
  authorizeInternalWorkflow,
  executeInternalWorkflow,
  internalWorkflowOptions,
} from "@/lib/internal-workflow"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/kek-rotation
 *
 * Re-wraps org DEKs under the current KEK (ADR-020). Runs on demand, not
 * on a schedule: production KEKs are write-only Vercel env vars, so the
 * rotation has to execute inside the deployment that holds them. Dry run
 * unless the body is `{ "apply": true }`; `hasMore` means call again.
 *
 * Authz: QStash signature or Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const denied = await authorizeInternalWorkflow(request)
  if (denied) return denied
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
  const parsed = KekRotationWorkflowRequestSchema.safeParse(json)
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }
  return executeInternalWorkflow(request, async () => ({
    ...(await rotateAllOrgKeks({
      dryRun: parsed.data.apply !== true,
      maxOrgs: parsed.data.maxOrgs,
    })),
  }))
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
