import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import {
  getExpertProfileByUserId,
  getOrCreateDefaultSchedule,
  updateScheduleTimezone,
  upsertDateOverride,
} from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"))
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const DateOverrideSchema = z
  .object({
    overrideDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    startTime: z.string().regex(timePattern).optional(),
    endTime: z.string().regex(timePattern).optional(),
    isBlocked: z.boolean(),
    timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), {
      message: "Invalid IANA timezone",
    }),
  })
  .refine(
    (d) =>
      d.isBlocked ||
      (d.startTime !== undefined &&
        d.endTime !== undefined &&
        d.startTime < d.endTime),
    { message: "Non-blocked overrides require ordered start/end times" }
  )

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

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

  const body = DateOverrideSchema.safeParse(
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

  if (schedule.timezone !== body.data.timezone) {
    await updateScheduleTimezone(
      profile.orgId,
      schedule.id,
      profile.id,
      body.data.timezone
    )
  }

  await upsertDateOverride(profile.orgId, schedule.id, profile.id, {
    scheduleId: schedule.id,
    overrideDate: body.data.overrideDate,
    startTime: body.data.isBlocked ? null : (body.data.startTime ?? null),
    endTime: body.data.isBlocked ? null : (body.data.endTime ?? null),
    isBlocked: body.data.isBlocked,
  })

  return secureJson({ ok: true }, { status: 201, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
