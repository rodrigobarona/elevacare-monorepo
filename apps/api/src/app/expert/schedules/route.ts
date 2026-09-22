import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  createSchedule,
  getExpertProfileByUserId,
  listSchedules,
} from "@eleva/db"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"))

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), {
    message: "Invalid IANA timezone",
  }),
  isDefault: z.boolean().optional(),
})

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")

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

  const schedules = await listSchedules(profile.orgId, profile.id)
  return secureJson({ schedules }, { status: 200, headers })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")

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

  const body = CreateScheduleSchema.safeParse(
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

  const existing = await listSchedules(profile.orgId, profile.id)
  const makeDefault = body.data.isDefault ?? existing.length === 0

  const schedule = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const created = await createSchedule(
        profile.orgId,
        {
          expertProfileId: profile.id,
          name: body.data.name,
          timezone: body.data.timezone,
          isDefault: makeDefault,
        },
        tx
      )
      await ctx.emit({
        entity: "schedule",
        action: "created",
        entityId: created.id,
        payload: { name: created.name, isDefault: created.isDefault },
      })
      return created
    }
  )

  return secureJson({ schedule }, { status: 201, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, OPTIONS"),
  })
}
