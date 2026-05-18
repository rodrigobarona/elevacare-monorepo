import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { withAudit } from "@eleva/audit"
import { getExpertProfileByUserId, createEventType } from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LocalizedTextSchema = z.object({
  en: z.string(),
  pt: z.string().optional(),
  es: z.string().optional(),
})

const CreateEventTypeSchema = z.object({
  slug: z.string().optional(),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema.nullish(),
  durationMinutes: z.number().int().positive(),
  priceAmount: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  languages: z.array(z.string()),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  bookingWindowDays: z.number().int().positive().nullish(),
  minimumNoticeMinutes: z.number().int().nonnegative(),
  bufferBeforeMinutes: z.number().int().nonnegative(),
  bufferAfterMinutes: z.number().int().nonnegative(),
  cancellationWindowHours: z.number().int().positive().nullish(),
  rescheduleWindowHours: z.number().int().positive().nullish(),
  requiresApproval: z.boolean(),
  worldwideMode: z.boolean(),
})

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

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

  const body = CreateEventTypeSchema.safeParse(
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

  const data = body.data
  const slug = normalizeSlug(data.slug || data.title.en || "event")
  if (slug.length < 3) {
    return secureJson(
      { error: "validation", message: "slug too short (min 3 chars)" },
      { status: 422, headers }
    )
  }

  try {
    const row = await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const created = await createEventType(
          profile.orgId,
          {
            expertProfileId: profile.id,
            orgId: profile.orgId,
            slug,
            title: data.title,
            description: data.description ?? null,
            durationMinutes: data.durationMinutes,
            priceAmount: data.priceAmount,
            currency: data.currency,
            languages: data.languages.length > 0 ? data.languages : ["en"],
            sessionMode: data.sessionMode,
            bookingWindowDays: data.bookingWindowDays ?? null,
            minimumNoticeMinutes: data.minimumNoticeMinutes,
            bufferBeforeMinutes: data.bufferBeforeMinutes,
            bufferAfterMinutes: data.bufferAfterMinutes,
            cancellationWindowHours: data.cancellationWindowHours ?? null,
            rescheduleWindowHours: data.rescheduleWindowHours ?? null,
            requiresApproval: data.requiresApproval,
            worldwideMode: data.worldwideMode,
          },
          tx
        )
        await ctx.emit({
          entity: "event_type",
          action: "created",
          entityId: created.id,
          payload: { slug, durationMinutes: data.durationMinutes },
        })
        return created
      }
    )

    return secureJson({ ok: true, id: row.id }, { status: 201, headers })
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

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
