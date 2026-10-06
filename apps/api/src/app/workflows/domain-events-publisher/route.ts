import { publishPendingDomainEvents } from "@eleva/workflows/domain-events"
import { defaultDomainEventSubscribers } from "@eleva/workflows/subscribers"
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

  try {
    const result = await publishPendingDomainEvents({
      subscribers: defaultDomainEventSubscribers(),
    })
    return secureJson({ ok: true, ...result }, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
