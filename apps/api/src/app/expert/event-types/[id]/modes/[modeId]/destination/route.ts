import { EventTypeDestinationOverrideSchema } from "@eleva/api-client"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { assertExternalCalendarOwned } from "@/lib/assert-external-calendar"
import { withAudit } from "@eleva/audit"
import {
  assertExpertOwnsCalendarIntegration,
  getEventType,
  getEventTypeMode,
  getExpertProfileByUserId,
  setEventTypeModeDestination,
} from "@eleva/db"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; modeId: string }> }

/**
 * PATCH /expert/event-types/[id]/modes/[modeId]/destination
 * Set or clear the per-mode destination override (highest priority).
 */
export async function PATCH(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "PATCH, OPTIONS")
  const { id: eventTypeId, modeId } = await params

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

  const body = EventTypeDestinationOverrideSchema.safeParse(
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

  const eventType = await getEventType(profile.orgId, eventTypeId, profile.id)
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  const mode = await getEventTypeMode(profile.orgId, modeId, eventTypeId)
  if (!mode) {
    return secureJson(
      { error: "not found", message: "mode not found" },
      { status: 404, headers }
    )
  }

  const { destinationIntegrationId, destinationExternalCalendarId } = body.data

  if (destinationIntegrationId && destinationExternalCalendarId) {
    const owns = await assertExpertOwnsCalendarIntegration(
      profile.orgId,
      profile.id,
      destinationIntegrationId
    )
    if (!owns) {
      return secureJson(
        {
          error: "forbidden",
          message: "calendar integration not owned by this expert",
        },
        { status: 403, headers }
      )
    }

    const calendarCheck = await assertExternalCalendarOwned({
      userId: session.user.id,
      orgId: profile.orgId,
      expertProfileId: profile.id,
      integrationId: destinationIntegrationId,
      externalCalendarId: destinationExternalCalendarId,
    })
    if (calendarCheck === "not_found") {
      return secureJson(
        { error: "not found", message: "integration not found" },
        { status: 404, headers }
      )
    }
    if (calendarCheck === "forbidden") {
      return secureJson(
        {
          error: "forbidden",
          message: "calendar not owned by this account",
        },
        { status: 403, headers }
      )
    }
    if (calendarCheck === "provider_error") {
      return secureJson(
        {
          error: "provider_error",
          message: "failed to fetch calendars from provider",
        },
        { status: 502, headers }
      )
    }
  }

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const ok = await setEventTypeModeDestination(
        profile.orgId,
        eventTypeId,
        modeId,
        {
          destinationIntegrationId,
          destinationExternalCalendarId,
        },
        tx
      )
      if (!ok) {
        throw new Error("mode not found during destination update")
      }
      await ctx.emit({
        entity: "event_type_mode",
        action: "updated",
        entityId: modeId,
        payload: {
          field: "destination",
          eventTypeId,
          destinationIntegrationId,
          destinationExternalCalendarId,
        },
      })
    }
  )

  return secureJson(
    {
      ok: true,
      destination: {
        destinationIntegrationId,
        destinationExternalCalendarId,
      },
    },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PATCH, OPTIONS"),
  })
}
