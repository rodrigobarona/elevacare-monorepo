import { CreateEventTypeModeRequestSchema } from "@eleva/api-client"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  createEventTypeMode,
  getEventType,
  getExpertProfileByUserId,
  getPracticeLocation,
  getSchedule,
  listEventTypeModes,
  lockEventTypeForUpdate,
} from "@eleva/db"
import {
  assertOfferInvariants,
  isUniqueViolation,
  OFFER_INVARIANT_MESSAGES,
  type OfferInvariantError,
} from "@eleva/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"

class ModeCreateNotFoundError extends Error {
  constructor() {
    super("event type not found")
    this.name = "ModeCreateNotFoundError"
  }
}

class ModeCreateValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModeCreateValidationError"
  }
}

class ModeCreateOfferInvariantError extends Error {
  code: OfferInvariantError
  constructor(code: OfferInvariantError) {
    super(OFFER_INVARIANT_MESSAGES[code])
    this.name = "ModeCreateOfferInvariantError"
    this.code = code
  }
}

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
  const { id: eventTypeId } = await params

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

  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "true"
  const modes = await listEventTypeModes(profile.orgId, eventTypeId, {
    includeInactive,
  })

  return secureJson({ modes }, { status: 200, headers })
}

export async function POST(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
  const { id: eventTypeId } = await params

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

  const body = CreateEventTypeModeRequestSchema.safeParse(
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
        if (!locked) throw new ModeCreateNotFoundError()

        const schedule = await getSchedule(
          profile.orgId,
          data.scheduleId,
          profile.id,
          tx
        )
        if (!schedule) {
          throw new ModeCreateValidationError(
            "Schedule not found for this expert."
          )
        }

        let locationCountry: string | null = null
        if (data.locationId) {
          const location = await getPracticeLocation(
            profile.orgId,
            data.locationId,
            profile.id,
            tx
          )
          if (!location || !location.active) {
            throw new ModeCreateValidationError(
              "Practice location not found or inactive."
            )
          }
          locationCountry = location.country
        }

        const invariant = assertOfferInvariants({
          kind: locked.kind,
          mode: data.mode,
          countryScopeType: data.countryScopeType,
          countryScopeCodes: data.countryScopeCodes,
          languages: data.languages,
          locationCountry,
          worldwideRemote: profile.worldwideRemote,
          serviceCountries: profile.serviceCountries,
          profileLanguages: profile.languages,
        })
        if (invariant) throw new ModeCreateOfferInvariantError(invariant)

        const created = await createEventTypeMode(
          profile.orgId,
          {
            eventTypeId,
            mode: data.mode,
            locationId: data.locationId ?? null,
            scheduleId: data.scheduleId,
            priceCents: data.priceCents ?? null,
            currency: data.currency ?? null,
            durationMinutes: data.durationMinutes ?? null,
            countryScopeType: data.countryScopeType,
            countryScopeCodes: data.countryScopeCodes,
            languages: data.languages,
            label: data.label ?? null,
            sortOrder: data.sortOrder ?? 0,
            active: data.active ?? true,
          },
          tx
        )
        await ctx.emit({
          entity: "event_type_mode",
          action: "created",
          entityId: created.id,
          payload: {
            eventTypeId,
            mode: created.mode,
            scheduleId: created.scheduleId,
          },
        })
        return created
      }
    )
  } catch (err) {
    if (err instanceof ModeCreateNotFoundError) {
      return secureJson(
        { error: "not found", message: err.message },
        { status: 404, headers }
      )
    }
    if (err instanceof ModeCreateValidationError) {
      return secureJson(
        { error: "validation", message: err.message },
        { status: 422, headers }
      )
    }
    if (err instanceof ModeCreateOfferInvariantError) {
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
    console.error("[event-type-modes] create failed", err)
    return secureJson(
      { error: "internal", message: "Internal server error" },
      { status: 500, headers }
    )
  }

  return secureJson({ mode }, { status: 201, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, OPTIONS"),
  })
}
