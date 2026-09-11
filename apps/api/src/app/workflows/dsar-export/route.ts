import { z } from "zod"
import { processDsarExport } from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { authorizeWorkflowSecret } from "@/lib/qstash-publish"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({
  dsarId: z.string().uuid(),
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
})

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  if (!process.env.WORKFLOWS_DRAIN_SECRET) {
    return secureJson(
      {
        error: "server_misconfiguration",
        message: "WORKFLOWS_DRAIN_SECRET is required",
      },
      { status: 500, headers }
    )
  }
  if (!authorizeWorkflowSecret(request)) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await processDsarExport(parsed.data)
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
