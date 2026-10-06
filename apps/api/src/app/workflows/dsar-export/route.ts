import { DsarExportWorkflowRequestSchema } from "@eleva/api-client"
import { processDsarExport } from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { authorizeInternalWorkflow } from "@/lib/internal-workflow"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  const denied = await authorizeInternalWorkflow(request)
  if (denied) return denied

  const parsed = DsarExportWorkflowRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await processDsarExport(parsed.data)
    if (result.retry) {
      return secureJson(
        { ok: false, error: "dsar_export_in_progress", ...result },
        { status: 500, headers }
      )
    }
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
