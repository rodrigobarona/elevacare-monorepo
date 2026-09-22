import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  countModesUsingSchedule,
  getExpertProfileByUserId,
  getSchedule,
  listAvailabilityRules,
  listDateOverrides,
  listModeNamesUsingSchedule,
  softDeleteSchedule,
  updateSchedule,
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

const PatchScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z
    .string()
    .refine((tz) => VALID_TIMEZONES.has(tz), {
      message: "Invalid IANA timezone",
    })
    .optional(),
  isDefault: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, PATCH, DELETE, OPTIONS")
  const { id } = await params

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

  const schedule = await getSchedule(profile.orgId, id, profile.id)
  if (!schedule) {
    return secureJson(
      { error: "not found", message: "schedule not found" },
      { status: 404, headers }
    )
  }

  const [rules, overrides] = await Promise.all([
    listAvailabilityRules(profile.orgId, id, profile.id),
    listDateOverrides(profile.orgId, id, profile.id),
  ])

  return secureJson(
    { schedule: { ...schedule, rules, overrides } },
    { status: 200, headers }
  )
}

export async function PATCH(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, PATCH, DELETE, OPTIONS")
  const { id } = await params

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

  const body = PatchScheduleSchema.safeParse(
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

  const existing = await getSchedule(profile.orgId, id, profile.id)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "schedule not found" },
      { status: 404, headers }
    )
  }

  if (body.data.isDefault === false && existing.isDefault) {
    return secureJson(
      {
        error: "validation",
        message:
          "Cannot unset the default schedule. Mark another schedule as default instead.",
      },
      { status: 422, headers }
    )
  }

  const schedule = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const updated = await updateSchedule(
        profile.orgId,
        id,
        profile.id,
        {
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.timezone !== undefined && {
            timezone: body.data.timezone,
          }),
          ...(body.data.isDefault !== undefined && {
            isDefault: body.data.isDefault,
          }),
        },
        tx
      )
      await ctx.emit({
        entity: "schedule",
        action: "updated",
        entityId: id,
        payload: { fields: Object.keys(body.data) },
      })
      return updated
    }
  )

  return secureJson({ schedule }, { status: 200, headers })
}

export async function DELETE(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, PATCH, DELETE, OPTIONS")
  const { id } = await params

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

  const existing = await getSchedule(profile.orgId, id, profile.id)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "schedule not found" },
      { status: 404, headers }
    )
  }

  if (existing.isDefault) {
    return secureJson(
      {
        error: "validation",
        message: "Cannot delete the default schedule.",
      },
      { status: 422, headers }
    )
  }

  const modeCount = await countModesUsingSchedule(profile.orgId, id)
  if (modeCount > 0) {
    const modes = await listModeNamesUsingSchedule(profile.orgId, id)
    return secureJson(
      {
        error: "SCHEDULE_IN_USE",
        message:
          "This schedule is used by one or more delivery modes. Reassign those modes first.",
        modes,
      },
      { status: 409, headers }
    )
  }

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        await softDeleteSchedule(profile.orgId, id, profile.id, tx)
        await ctx.emit({
          entity: "schedule",
          action: "deleted",
          entityId: id,
          payload: { name: existing.name },
        })
      }
    )
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "cannot-delete-default-schedule"
    ) {
      return secureJson(
        {
          error: "validation",
          message: "Cannot delete the default schedule.",
        },
        { status: 422, headers }
      )
    }
    throw err
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PATCH, DELETE, OPTIONS"),
  })
}
