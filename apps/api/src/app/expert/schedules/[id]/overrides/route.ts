import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  getSchedule,
  replaceDateOverrides,
} from "@eleva/db"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const OverrideSchema = z
  .object({
    overrideDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    startTime: z.string().regex(timePattern).nullish(),
    endTime: z.string().regex(timePattern).nullish(),
    isBlocked: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.isBlocked) {
      if (value.startTime || value.endTime) {
        ctx.addIssue({
          code: "custom",
          message: "Blocked days must not include startTime/endTime.",
          path: ["startTime"],
        })
      }
      return
    }
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Open overrides require startTime and endTime.",
        path: ["startTime"],
      })
      return
    }
    if (value.startTime >= value.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "startTime must be before endTime.",
        path: ["endTime"],
      })
    }
  })

const PutOverridesSchema = z.object({
  overrides: z.array(OverrideSchema),
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

  const body = PutOverridesSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const dates = body.data.overrides.map((o) => o.overrideDate)
  if (new Set(dates).size !== dates.length) {
    return secureJson(
      {
        error: "validation",
        message: "Each overrideDate may appear only once per schedule.",
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

  const overrides = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const saved = await replaceDateOverrides(
        profile.orgId,
        id,
        profile.id,
        body.data.overrides.map((o) => ({
          overrideDate: o.overrideDate,
          startTime: o.isBlocked ? null : (o.startTime ?? null),
          endTime: o.isBlocked ? null : (o.endTime ?? null),
          isBlocked: o.isBlocked,
        })),
        tx
      )
      await ctx.emit({
        entity: "schedule",
        action: "updated",
        entityId: id,
        payload: { overridesCount: saved.length, surface: "overrides" },
      })
      return saved
    }
  )

  return secureJson({ overrides }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PUT, OPTIONS"),
  })
}
