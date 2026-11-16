import { withAudit } from "@eleva/audit"
import { CalendarReminderRequestSchema } from "@eleva/api-client"
import {
  getDestinationCalendar,
  getExpertProfileForOrg,
  setCalendarReminder,
} from "@eleva/db"
import { logError } from "@eleva/observability"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

/**
 * The reminder on sessions Eleva adds to the expert's own calendar. It lives
 * with the default destination calendar, so it needs one first (409
 * `destination_required`). Members get Eleva's own reminders; this does not
 * change them.
 */
export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "GET, PUT, OPTIONS"

async function authorize(
  request: Request,
  headers: ReturnType<typeof corsHeaders>
) {
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
  return { session, profile }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const auth = await authorize(request, headers)
  if (auth instanceof Response) return auth

  const destination = await getDestinationCalendar(
    auth.profile.orgId,
    auth.profile.id
  )
  const body = {
    reminderMinutes: destination?.reminderMinutes ?? null,
    hasDestination: destination !== null,
  }
  return secureJson(body, { status: 200, headers })
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const auth = await authorize(request, headers)
  if (auth instanceof Response) return auth
  const { session, profile } = auth

  const body = CalendarReminderRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const updated = await setCalendarReminder(
          profile.orgId,
          profile.id,
          body.data.reminderMinutes,
          tx
        )
        // No destination row: nothing changed, so nothing to audit.
        if (!updated) throw new DestinationRequired()
        await ctx.emit({
          entity: "expert_profile",
          action: "updated",
          entityId: profile.id,
          payload: {
            field: "calendar_reminder_minutes",
            reminderMinutes: body.data.reminderMinutes,
          },
        })
      }
    )
  } catch (err) {
    if (err instanceof DestinationRequired) {
      return secureJson(
        {
          error: "destination_required",
          message:
            "Choose where new sessions go before setting their reminder.",
        },
        { status: 409, headers }
      )
    }
    logError("calendar.reminder_save_failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}

class DestinationRequired extends Error {
  constructor() {
    super("destination_required")
    this.name = "DestinationRequired"
  }
}
