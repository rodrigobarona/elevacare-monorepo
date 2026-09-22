import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  getSchedule,
  replaceAvailabilityRules,
} from "@eleva/db"
import { normalizeAvailabilityRules } from "@eleva/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const PutRulesSchema = z.object({
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(timePattern, "Expected HH:MM"),
      endTime: z.string().regex(timePattern, "Expected HH:MM"),
    })
  ),
})

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "PUT, OPTIONS")
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

  const body = PutRulesSchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const normalized = normalizeAvailabilityRules(body.data.rules)
  if (!normalized.ok) {
    return secureJson(
      {
        error: "validation",
        code: normalized.error,
        message: normalized.message,
      },
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

  const schedule = await getSchedule(profile.orgId, id, profile.id)
  if (!schedule) {
    return secureJson(
      { error: "not found", message: "schedule not found" },
      { status: 404, headers }
    )
  }

  const rules = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const saved = await replaceAvailabilityRules(
        profile.orgId,
        id,
        profile.id,
        normalized.rules.map((r) => ({
          scheduleId: id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
        tx
      )
      await ctx.emit({
        entity: "schedule",
        action: "updated",
        entityId: id,
        payload: { rulesCount: saved.length, surface: "rules" },
      })
      return saved
    }
  )

  return secureJson({ rules }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PUT, OPTIONS"),
  })
}
