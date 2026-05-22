import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  listCalendarIntegrations,
  disconnectIntegration,
} from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "DELETE, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "events:manage")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const { id } = await params

  const integrations = await listCalendarIntegrations(profile.orgId, profile.id)
  const integration = integrations.find((i) => i.id === id)
  if (!integration) {
    return secureJson(
      { error: "not found", message: "integration not found" },
      { status: 404, headers }
    )
  }

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (_tx, ctx) => {
      await disconnectIntegration(profile.orgId, id, profile.id)
      await ctx.emit({
        entity: "expert_integration_credential",
        action: "disconnected",
        entityId: id,
        payload: { slug: integration.slug },
      })
    }
  )

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "DELETE, OPTIONS"),
  })
}
