import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  listCalendarIntegrations,
  replaceBusySources,
} from "@eleva/db"
import {
  getAdapter,
  getCalendarToken,
  type CalendarProvider,
} from "@eleva/calendar"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

const BusySourcesSchema = z.object({
  sources: z.array(
    z.object({
      externalCalendarId: z.string(),
      displayName: z.string(),
    })
  ),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "PUT, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = BusySourcesSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

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

  const provider = SLUG_TO_PROVIDER[integration.slug]
  if (!provider) {
    return secureJson(
      { error: "not found", message: "unknown provider" },
      { status: 404, headers }
    )
  }

  let accessToken: string
  let providerCalendars: { id: string; name: string }[]
  try {
    accessToken = await getCalendarToken(session.user.workosUserId, provider)
    const adapter = getAdapter(provider)
    providerCalendars = await adapter.listCalendars(accessToken)
  } catch {
    return secureJson(
      {
        error: "provider_error",
        message: "failed to fetch calendars from provider",
      },
      { status: 502, headers }
    )
  }

  const allowedIds = new Set(providerCalendars.map((c) => c.id))

  if (body.data.sources.some((s) => !allowedIds.has(s.externalCalendarId))) {
    return secureJson(
      { error: "forbidden", message: "calendar not owned by this account" },
      { status: 403, headers }
    )
  }

  const enriched = body.data.sources.map((s) => ({
    externalCalendarId: s.externalCalendarId,
    displayName:
      providerCalendars.find((c) => c.id === s.externalCalendarId)?.name ??
      s.displayName,
  }))

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (_tx, ctx) => {
      await replaceBusySources(profile.orgId, id, enriched, profile.id)
      await ctx.emit({
        entity: "expert_integration_credential",
        action: "updated",
        entityId: id,
        payload: { field: "busySources", count: enriched.length },
      })
    }
  )

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PUT, OPTIONS"),
  })
}
