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
 * HTTP trigger for the audit outbox drainer. Called by:
 *   - QStash schedule (every 30s in staging/prod) — wiring lands with
 *     infra/qstash in S4.
 *   - The operator dashboard "manual drain" button in S6.
 *   - CI integration test.
 *
 * Authz: QStash signature or Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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
