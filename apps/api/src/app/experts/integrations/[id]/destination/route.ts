import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  listCalendarIntegrations,
  replaceDestinationCalendar,
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

const DestinationSchema = z.object({
  externalCalendarId: z.string(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "PUT, OPTIONS")

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

  const body = DestinationSchema.safeParse(
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

  const accessToken = await getCalendarToken(
    session.user.workosUserId,
    provider
  )
  const adapter = getAdapter(provider)
  const calendars = await adapter.listCalendars(accessToken)

  const matched = calendars.find((c) => c.id === body.data.externalCalendarId)
  if (!matched) {
    return secureJson(
      { error: "forbidden", message: "calendar not owned by this account" },
      { status: 403, headers }
    )
  }

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await replaceDestinationCalendar(
        profile.orgId,
        profile.id,
        id,
        body.data.externalCalendarId,
        matched.name,
        tx
      )
      await ctx.emit({
        entity: "expert_integration_credential",
        action: "updated",
        entityId: id,
        payload: {
          field: "destination",
          externalCalendarId: body.data.externalCalendarId,
        },
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
