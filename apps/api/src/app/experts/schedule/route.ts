import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  getOrCreateDefaultSchedule,
  updateScheduleTimezone,
  replaceAvailabilityRules,
  listAvailabilityRules,
  listDateOverrides,
} from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"))
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const SaveScheduleSchema = z.object({
  timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), {
    message: "Invalid IANA timezone",
  }),
  rules: z.array(
    z
      .object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(timePattern, "Expected HH:MM"),
        endTime: z.string().regex(timePattern, "Expected HH:MM"),
      })
      .refine((r) => r.startTime < r.endTime, {
        message: "startTime must be before endTime",
      })
  ),
})

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "schedule:manage")
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

  const tz =
    (profile as { timezone?: string }).timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone
  const schedule = await getOrCreateDefaultSchedule(
    profile.orgId,
    profile.id,
    tz
  )
  const [rules, overrides] = await Promise.all([
    listAvailabilityRules(profile.orgId, schedule.id, profile.id),
    listDateOverrides(profile.orgId, schedule.id, profile.id),
  ])

  return secureJson(
    { schedule: { ...schedule, rules, overrides } },
    { status: 200, headers }
  )
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "schedule:manage")
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

  const body = SaveScheduleSchema.safeParse(
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

  const schedule = await getOrCreateDefaultSchedule(
    profile.orgId,
    profile.id,
    body.data.timezone
  )

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await updateScheduleTimezone(
        profile.orgId,
        schedule.id,
        profile.id,
        body.data.timezone,
        tx
      )
      await replaceAvailabilityRules(
        profile.orgId,
        schedule.id,
        profile.id,
        body.data.rules.map((r) => ({
          scheduleId: schedule.id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
        tx
      )
      await ctx.emit({
        entity: "schedule",
        action: "updated",
        entityId: schedule.id,
        payload: {
          timezone: body.data.timezone,
          rulesCount: body.data.rules.length,
        },
      })
    }
  )

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PUT, OPTIONS"),
  })
}
