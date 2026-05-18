import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  updateEventType,
  deleteEventType,
} from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LocalizedTextSchema = z.object({
  en: z.string(),
  pt: z.string().optional(),
  es: z.string().optional(),
})

const UpdateEventTypeSchema = z.object({
  slug: z.string().optional(),
  title: LocalizedTextSchema.optional(),
  description: LocalizedTextSchema.nullish(),
  durationMinutes: z.number().int().positive().optional(),
  priceAmount: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  languages: z.array(z.string()).optional(),
  sessionMode: z.enum(["online", "in_person", "phone"]).optional(),
  bookingWindowDays: z.number().int().positive().nullish(),
  minimumNoticeMinutes: z.number().int().nonnegative().optional(),
  bufferBeforeMinutes: z.number().int().nonnegative().optional(),
  bufferAfterMinutes: z.number().int().nonnegative().optional(),
  cancellationWindowHours: z.number().int().positive().nullish(),
  rescheduleWindowHours: z.number().int().positive().nullish(),
  requiresApproval: z.boolean().optional(),
  worldwideMode: z.boolean().optional(),
  published: z.boolean().optional(),
})

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "PATCH, DELETE, OPTIONS")

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

  const body = UpdateEventTypeSchema.safeParse(
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
  const data = body.data

  const updates: Record<string, unknown> = {}
  if (data.slug !== undefined) {
    const slug = normalizeSlug(data.slug)
    if (slug.length < 3) {
      return secureJson(
        { error: "validation", message: "slug too short (min 3 chars)" },
        { status: 422, headers }
      )
    }
    updates.slug = slug
  }
  if (data.title !== undefined) updates.title = data.title
  if (data.description !== undefined) updates.description = data.description
  if (data.durationMinutes !== undefined)
    updates.durationMinutes = data.durationMinutes
  if (data.priceAmount !== undefined) updates.priceAmount = data.priceAmount
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.languages !== undefined) updates.languages = data.languages
  if (data.sessionMode !== undefined) updates.sessionMode = data.sessionMode
  if (data.bookingWindowDays !== undefined)
    updates.bookingWindowDays = data.bookingWindowDays
  if (data.minimumNoticeMinutes !== undefined)
    updates.minimumNoticeMinutes = data.minimumNoticeMinutes
  if (data.bufferBeforeMinutes !== undefined)
    updates.bufferBeforeMinutes = data.bufferBeforeMinutes
  if (data.bufferAfterMinutes !== undefined)
    updates.bufferAfterMinutes = data.bufferAfterMinutes
  if (data.cancellationWindowHours !== undefined)
    updates.cancellationWindowHours = data.cancellationWindowHours
  if (data.rescheduleWindowHours !== undefined)
    updates.rescheduleWindowHours = data.rescheduleWindowHours
  if (data.requiresApproval !== undefined)
    updates.requiresApproval = data.requiresApproval
  if (data.worldwideMode !== undefined)
    updates.worldwideMode = data.worldwideMode
  if (data.published !== undefined) updates.published = data.published

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        await updateEventType(
          profile.orgId,
          id,
          updates as Parameters<typeof updateEventType>[2],
          profile.id,
          tx
        )
        await ctx.emit({
          entity: "event_type",
          action: "updated",
          entityId: id,
          payload: { fields: Object.keys(updates) },
        })
      }
    )
    return secureJson({ ok: true }, { status: 200, headers })
  } catch (err) {
    const dbErr = err as { code?: string; constraint?: string }
    if (
      dbErr?.code === "23505" ||
      dbErr?.constraint === "event_types_expert_slug_idx"
    ) {
      return secureJson(
        { error: "conflict", message: "slug already taken" },
        { status: 409, headers }
      )
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson({ error: "internal", message }, { status: 500, headers })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "PATCH, DELETE, OPTIONS")

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

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const { id } = await params
  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await deleteEventType(profile.orgId, id, profile.id, tx)
      await ctx.emit({
        entity: "event_type",
        action: "deleted",
        entityId: id,
        payload: {},
      })
    }
  )

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PATCH, DELETE, OPTIONS"),
  })
}
