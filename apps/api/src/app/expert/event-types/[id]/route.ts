import { UpdateEventTypeRequestSchema } from "@eleva/api-client"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getEventType,
  getExpertProfileByUserId,
  getPracticeLocation,
  listEventTypeModes,
  lockEventTypeForUpdate,
  updateEventType,
  deleteEventType,
} from "@eleva/db"
import {
  assertOfferInvariants,
  OFFER_INVARIANT_MESSAGES,
  type OfferInvariantError,
} from "@eleva/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"

class KindOfferInvariantError extends Error {
  code: OfferInvariantError
  constructor(code: OfferInvariantError) {
    super(OFFER_INVARIANT_MESSAGES[code])
    this.name = "KindOfferInvariantError"
    this.code = code
  }
}

class EventTypeNotFoundError extends Error {
  constructor() {
    super("event type not found")
    this.name = "EventTypeNotFoundError"
  }
}

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const UpdateEventTypeSchema = UpdateEventTypeRequestSchema

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

  const existing = await getEventType(profile.orgId, id, profile.id)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

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
  if (data.kind !== undefined) updates.kind = data.kind
  if (data.visibility !== undefined) updates.visibility = data.visibility
  if (data.bookingWindowDays !== undefined)
    updates.bookingWindowDays = data.bookingWindowDays
  if (data.minimumNoticeMinutes !== undefined)
    updates.minimumNoticeMinutes = data.minimumNoticeMinutes
  if (data.bufferBeforeMinutes !== undefined)
    updates.bufferBeforeMinutes = data.bufferBeforeMinutes
  if (data.bufferAfterMinutes !== undefined)
    updates.bufferAfterMinutes = data.bufferAfterMinutes
  if (data.cancellationPolicy !== undefined)
    updates.cancellationPolicy = data.cancellationPolicy
  if (data.rescheduleWindowHours !== undefined)
    updates.rescheduleWindowHours = data.rescheduleWindowHours
  if (data.requiresApproval !== undefined)
    updates.requiresApproval = data.requiresApproval
  if (data.worldwideMode !== undefined)
    updates.worldwideMode = data.worldwideMode
  if (data.published !== undefined) updates.published = data.published

  if (Object.keys(updates).length === 0) {
    return secureJson({ ok: true }, { status: 200, headers })
  }

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const locked = await lockEventTypeForUpdate(
          profile.orgId,
          id,
          profile.id,
          tx
        )
        if (!locked) throw new EventTypeNotFoundError()

        if (data.kind !== undefined && data.kind !== locked.kind) {
          const modes = await listEventTypeModes(
            profile.orgId,
            id,
            undefined,
            tx
          )
          for (const mode of modes) {
            let locationCountry: string | null = null
            if (mode.mode === "in_person" && mode.locationId) {
              const location = await getPracticeLocation(
                profile.orgId,
                mode.locationId,
                profile.id,
                tx
              )
              locationCountry = location?.country ?? null
            }
            const invariant = assertOfferInvariants({
              kind: data.kind,
              mode: mode.mode,
              countryScopeType: mode.countryScopeType,
              countryScopeCodes: mode.countryScopeCodes as string[],
              languages: mode.languages as string[],
              locationCountry,
              worldwideRemote: profile.worldwideRemote,
              serviceCountries: profile.serviceCountries,
              profileLanguages: profile.languages,
            })
            if (invariant) throw new KindOfferInvariantError(invariant)
          }
        }

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
    if (err instanceof EventTypeNotFoundError) {
      return secureJson(
        { error: "not found", message: err.message },
        { status: 404, headers }
      )
    }
    if (err instanceof KindOfferInvariantError) {
      return secureJson(
        {
          error: "OFFER_INVARIANT_VIOLATION",
          code: err.code,
          message: err.message,
        },
        { status: 422, headers }
      )
    }
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

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const { id } = await params
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson({ error: "internal", message }, { status: 500, headers })
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PATCH, DELETE, OPTIONS"),
  })
}
