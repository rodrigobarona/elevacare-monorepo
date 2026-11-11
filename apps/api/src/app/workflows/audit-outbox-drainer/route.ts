import { drainAuditOutbox } from "@eleva/workflows/drainers"
import { corsHeaders } from "@/lib/cors"
import { authorizeInternalWorkflow } from "@/lib/internal-workflow"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/audit-outbox-drainer
 *
 * Ships `audit_outbox` rows to the append-only audit database. Runs every
 * hour inside the hourly tick (`apps/api/src/lib/workflow-ticks.ts`, Vercel
 * Cron) and drains until nothing is pending, oldest first. Also callable
 * by hand.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET` or a QStash signature.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// A full run ships up to 2,000 rows one by one to a second database.
export const maxDuration = 300

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  const denied = await authorizeInternalWorkflow(request)
  if (denied) return denied

  try {
    const result = await drainAuditOutbox()
    return secureJson({ ok: true, ...result }, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
