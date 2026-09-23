import { PatchEventTypeModeRequestSchema } from "@eleva/api-client"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  deactivateEventTypeMode,
  getEventType,
  getEventTypeMode,
  getExpertProfileByUserId,
  getPracticeLocation,
  getSchedule,
  listEventTypeModes,
  lockEventTypeForUpdate,
  updateEventTypeMode,
  type Tx,
} from "@eleva/db"
import {
  assertOfferInvariants,
  isUniqueViolation,
  OFFER_INVARIANT_MESSAGES,
  type OfferInvariantError,
} from "@eleva/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; modeId: string }> }

class LastActiveModeConflictError extends Error {
  constructor() {
    super("Unpublish the event type before deactivating its last active mode.")
    this.name = "LastActiveModeConflictError"
  }
}

class ModeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModeValidationError"
  }
}

class ModeOfferInvariantError extends Error {
  code: OfferInvariantError
  constructor(code: OfferInvariantError) {
    super(OFFER_INVARIANT_MESSAGES[code])
    this.name = "ModeOfferInvariantError"
    this.code = code
  }
}

class ModeNotFoundError extends Error {
  constructor() {
    super("mode not found")
    this.name = "ModeNotFoundError"
  }
}

async function assertNotLastActiveMode(
  orgId: string,
  eventTypeId: string,
  modeId: string,
  published: boolean,
  modeActive: boolean,
  tx: Tx
): Promise<void> {
  if (!published || !modeActive) return
  const activeModes = await listEventTypeModes(
    orgId,
    eventTypeId,
    undefined,
    tx
  )
  if (!activeModes.some((row) => row.id !== modeId)) {
    throw new LastActiveModeConflictError()
  }
}

export async function GET(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, PATCH, DELETE, OPTIONS")
  const { id: eventTypeId, modeId } = await params

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

  const eventType = await getEventType(profile.orgId, eventTypeId, profile.id)
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  const mode = await getEventTypeMode(profile.orgId, modeId, eventTypeId)
  if (!mode) {
    return secureJson(
      { error: "not found", message: "mode not found" },
      { status: 404, headers }
    )
  }

  return secureJson({ mode }, { status: 200, headers })
}

export async function PATCH(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, PATCH, DELETE, OPTIONS")
  const { id: eventTypeId, modeId } = await params

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

  const body = PatchEventTypeModeRequestSchema.safeParse(
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

  const eventType = await getEventType(profile.orgId, eventTypeId, profile.id)
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  const data = body.data

  let mode
  try {
    mode = await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const locked = await lockEventTypeForUpdate(
          profile.orgId,
          eventTypeId,
          profile.id,
          tx
        )
        if (!locked) throw new ModeNotFoundError()

        const current = await getEventTypeMode(
          profile.orgId,
          modeId,
          eventTypeId,
          tx
        )
        if (!current) throw new ModeNotFoundError()

        if (data.active === false) {
          await assertNotLastActiveMode(
            profile.orgId,
            eventTypeId,
            modeId,
            locked.published,
            current.active,
            tx
          )
        }

        const deactivateOnly =
          data.active === false &&
          Object.keys(data).every(
            (key) => key === "active" || key === "sortOrder" || key === "label"
          )

        const nextPriceCents =
          data.priceCents !== undefined
            ? (data.priceCents ?? null)
            : current.priceCents
        const nextCurrency =
          data.currency !== undefined
            ? (data.currency ?? null)
            : current.currency
        if (
          !deactivateOnly &&
          (nextPriceCents == null) !== (nextCurrency == null)
        ) {
          throw new ModeValidationError(
            "priceCents and currency must both be set or both omitted."
          )
        }

        const nextScheduleId = data.scheduleId ?? current.scheduleId
        if (!deactivateOnly && data.scheduleId) {
          const schedule = await getSchedule(
            profile.orgId,
            data.scheduleId,
            profile.id,
            tx
          )
          if (!schedule) {
            throw new ModeValidationError("Schedule not found for this expert.")
          }
        }

        const nextLocationId =
          data.locationId !== undefined ? data.locationId : current.locationId
        let locationCountry: string | null = null
        if (!deactivateOnly && current.mode === "in_person") {
          if (!nextLocationId) {
            throw new ModeValidationError(
              "In-person modes need a practice location."
            )
          }
          const location = await getPracticeLocation(
            profile.orgId,
            nextLocationId,
            profile.id,
            tx
          )
          if (!location || !location.active) {
            throw new ModeValidationError(
              "Practice location not found or inactive."
            )
          }
          locationCountry = location.country
        } else if (!deactivateOnly && nextLocationId) {
          throw new ModeValidationError(
            "Only in-person modes may set a location."
          )
        }

        const nextScopeType = data.countryScopeType ?? current.countryScopeType
        const nextScopeCodes =
          data.countryScopeCodes ?? current.countryScopeCodes
        const nextLanguages = data.languages ?? current.languages

        if (!deactivateOnly) {
          const invariant = assertOfferInvariants({
            kind: locked.kind,
            mode: current.mode,
            countryScopeType: nextScopeType,
            countryScopeCodes: nextScopeCodes,
            languages: nextLanguages,
            locationCountry,
            worldwideRemote: profile.worldwideRemote,
            serviceCountries: profile.serviceCountries,
            profileLanguages: profile.languages,
          })
          if (invariant) throw new ModeOfferInvariantError(invariant)
        }

        const updated = await updateEventTypeMode(
          profile.orgId,
          modeId,
          eventTypeId,
          {
            ...(data.locationId !== undefined && {
              locationId: data.locationId ?? null,
            }),
            ...(data.scheduleId !== undefined && {
              scheduleId: nextScheduleId,
            }),
            ...(data.priceCents !== undefined && {
              priceCents: data.priceCents ?? null,
            }),
            ...(data.currency !== undefined && {
              currency: data.currency ?? null,
            }),
            ...(data.durationMinutes !== undefined && {
              durationMinutes: data.durationMinutes ?? null,
            }),
            ...(data.countryScopeType !== undefined && {
              countryScopeType: data.countryScopeType,
            }),
            ...(data.countryScopeCodes !== undefined && {
              countryScopeCodes: data.countryScopeCodes,
            }),
            ...(data.languages !== undefined && { languages: data.languages }),
            ...(data.label !== undefined && { label: data.label ?? null }),
            ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
            ...(data.active !== undefined && { active: data.active }),
          },
          tx
        )
        await ctx.emit({
          entity: "event_type_mode",
          action: "updated",
          entityId: modeId,
          payload: { eventTypeId, fields: Object.keys(data) },
        })
        return updated
      }
    )
  } catch (err) {
    if (err instanceof ModeNotFoundError) {
      return secureJson(
        { error: "not found", message: err.message },
        { status: 404, headers }
      )
    }
    if (err instanceof LastActiveModeConflictError) {
      return secureJson(
        { error: "conflict", message: err.message },
        { status: 409, headers }
      )
    }
    if (err instanceof ModeValidationError) {
      return secureJson(
        { error: "validation", message: err.message },
        { status: 422, headers }
      )
    }
    if (err instanceof ModeOfferInvariantError) {
      return secureJson(
        {
          error: "OFFER_INVARIANT_VIOLATION",
          code: err.code,
          message: err.message,
        },
        { status: 422, headers }
      )
    }
    if (isUniqueViolation(err)) {
      return secureJson(
        {
          error: "conflict",
          message: "This delivery mode already exists for the event type.",
        },
        { status: 409, headers }
      )
    }
    console.error("[event-type-modes] update failed", err)
    return secureJson(
      { error: "internal", message: "Internal server error" },
      { status: 500, headers }
    )
  }

  return secureJson({ mode }, { status: 200, headers })
}

export async function DELETE(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, PATCH, DELETE, OPTIONS")
  const { id: eventTypeId, modeId } = await params

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

  const eventType = await getEventType(profile.orgId, eventTypeId, profile.id)
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  const existing = await getEventTypeMode(profile.orgId, modeId, eventTypeId)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "mode not found" },
      { status: 404, headers }
    )
  }

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const locked = await lockEventTypeForUpdate(
          profile.orgId,
          eventTypeId,
          profile.id,
          tx
        )
        if (!locked) throw new ModeNotFoundError()
        const current = await getEventTypeMode(
          profile.orgId,
          modeId,
          eventTypeId,
          tx
        )
        if (!current) throw new ModeNotFoundError()
        await assertNotLastActiveMode(
          profile.orgId,
          eventTypeId,
          modeId,
          locked.published,
          current.active,
          tx
        )
        await deactivateEventTypeMode(profile.orgId, modeId, eventTypeId, tx)
        await ctx.emit({
          entity: "event_type_mode",
          action: "deleted",
          entityId: modeId,
          payload: { eventTypeId, soft: true },
        })
      }
    )
  } catch (err) {
    if (err instanceof ModeNotFoundError) {
      return secureJson(
        { error: "not found", message: err.message },
        { status: 404, headers }
      )
    }
    if (err instanceof LastActiveModeConflictError) {
      return secureJson(
        { error: "conflict", message: err.message },
        { status: 409, headers }
      )
    }
    console.error("[event-type-modes] delete failed", err)
    return secureJson(
      { error: "internal", message: "Internal server error" },
      { status: 500, headers }
    )
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PATCH, DELETE, OPTIONS"),
  })
}
