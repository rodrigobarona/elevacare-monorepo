import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { z } from "zod"
import { withAudit } from "@eleva/audit"
import { releaseCalendarAccount, revokeProviderGrant } from "@eleva/auth"
import {
  getExpertProfileForOrg,
  listCalendarIntegrations,
  disconnectIntegration,
} from "@eleva/db"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

const PROVIDER_FOR_SLUG: Record<string, string> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const IntegrationIdSchema = z.string().uuid()

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

  const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const parsedId = IntegrationIdSchema.safeParse((await params).id)
  if (!parsedId.success) {
    return secureJson(
      { error: "invalid_body", issues: parsedId.error.issues },
      { status: 422, headers }
    )
  }
  const id = parsedId.data

  const integrations = await listCalendarIntegrations(profile.orgId, profile.id)
  const integration = integrations.find((i) => i.id === id)
  if (!integration) {
    return secureJson(
      { error: "not found", message: "integration not found" },
      { status: 404, headers }
    )
  }

  // Withdraw Eleva's grant at Google first (best effort; it needs the
  // stored token), then delete the tokens and calendar permissions with
  // the disconnect, so the account is not relinked on the next visit.
  const authAccountId = integration.authAccountId
  const providerId = PROVIDER_FOR_SLUG[integration.slug]
  const revokedAtProvider =
    authAccountId && providerId
      ? await revokeProviderGrant({
          providerId,
          accountId: authAccountId,
          userId: session.user.id,
        })
      : false

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await disconnectIntegration(profile.orgId, id, profile.id, tx)
      const tokensCleared = authAccountId
        ? await releaseCalendarAccount(tx, {
            accountId: authAccountId,
            userId: session.user.id,
          })
        : false
      await ctx.emit({
        entity: "expert_integration_credential",
        action: "disconnected",
        entityId: id,
        payload: { slug: integration.slug, tokensCleared, revokedAtProvider },
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
