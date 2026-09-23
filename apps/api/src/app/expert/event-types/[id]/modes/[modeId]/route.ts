import { z } from "zod"
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
  updateEventTypeMode,
} from "@eleva/db"
import {
  assertOfferInvariants,
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

const MESSAGES: Record<OfferInvariantError, string> = {
  CLINICAL_WORLDWIDE:
    "Clinical services cannot be offered worldwide. Limit the mode to countries you are licensed to serve.",
  SCOPE_OUTSIDE_SERVICE_COUNTRIES:
    "This mode targets a country outside your declared service countries. Update practice countries or the mode scope.",
  EMPTY_COUNTRY_LIST:
    "This mode needs at least one country when scope is a country list.",
  WORLDWIDE_WITH_COUNTRY_LIST:
    "Worldwide scope cannot also list specific countries.",
  IN_PERSON_COUNTRY_MISMATCH:
    "In-person modes must target exactly the location country.",
  IN_PERSON_LOCATION_REQUIRED: "In-person modes need a practice location.",
  WORLDWIDE_REQUIRES_REMOTE:
    "Worldwide remote requires worldwideRemote on your practice profile.",
  LANGUAGE_NOT_ON_PROFILE:
    "This mode uses a language that is not on your practice profile.",
  EMPTY_LANGUAGE_LIST: "Each delivery mode needs at least one language.",
}

const countryCode = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase())

const PatchModeSchema = z
  .object({
    locationId: z.string().uuid().nullish(),
    scheduleId: z.string().uuid().optional(),
    priceCents: z.number().int().nonnegative().nullish(),
    currency: z.literal("EUR").nullish(),
    durationMinutes: z.number().int().positive().nullish(),
    countryScopeType: z.enum(["worldwide", "list"]).optional(),
    countryScopeCodes: z.array(countryCode).optional(),
    languages: z.array(z.string().min(2).max(16)).min(1).optional(),
    label: z
      .object({
        en: z.string().min(1).max(200),
        pt: z.string().min(1).max(200).optional(),
        es: z.string().min(1).max(200).optional(),
      })
      .nullish(),
    sortOrder: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.countryScopeType === "worldwide" &&
      value.countryScopeCodes &&
      value.countryScopeCodes.length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Worldwide scope cannot also list specific countries.",
        path: ["countryScopeCodes"],
      })
    }
    if (
      value.countryScopeType === "list" &&
      value.countryScopeCodes &&
      value.countryScopeCodes.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "List scope needs at least one country.",
        path: ["countryScopeCodes"],
      })
    }
    if (
      value.priceCents !== undefined &&
      value.currency !== undefined &&
      (value.priceCents == null) !== (value.currency == null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "priceCents and currency must both be set or both omitted.",
        path: ["priceCents"],
      })
    }
  })

type Params = { params: Promise<{ id: string; modeId: string }> }

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

  const body = PatchModeSchema.safeParse(await request.json().catch(() => ({})))
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

  const existing = await getEventTypeMode(profile.orgId, modeId, eventTypeId)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "mode not found" },
      { status: 404, headers }
    )
  }

  const data = body.data
  const nextScheduleId = data.scheduleId ?? existing.scheduleId
  if (data.scheduleId) {
    const schedule = await getSchedule(
      profile.orgId,
      data.scheduleId,
      profile.id
    )
    if (!schedule) {
      return secureJson(
        { error: "validation", message: "Schedule not found for this expert." },
        { status: 422, headers }
      )
    }
  }

  const nextLocationId =
    data.locationId !== undefined ? data.locationId : existing.locationId
  let locationCountry: string | null = null
  if (existing.mode === "in_person") {
    if (!nextLocationId) {
      return secureJson(
        {
          error: "validation",
          message: "In-person modes need a practice location.",
        },
        { status: 422, headers }
      )
    }
    const location = await getPracticeLocation(
      profile.orgId,
      nextLocationId,
      profile.id
    )
    if (!location || !location.active) {
      return secureJson(
        {
          error: "validation",
          message: "Practice location not found or inactive.",
        },
        { status: 422, headers }
      )
    }
    locationCountry = location.country
  } else if (nextLocationId) {
    return secureJson(
      {
        error: "validation",
        message: "Only in-person modes may set a location.",
      },
      { status: 422, headers }
    )
  }

  const nextScopeType = data.countryScopeType ?? existing.countryScopeType
  const nextScopeCodes = data.countryScopeCodes ?? existing.countryScopeCodes
  const nextLanguages = data.languages ?? existing.languages

  const invariant = assertOfferInvariants({
    kind: eventType.kind,
    mode: existing.mode,
    countryScopeType: nextScopeType,
    countryScopeCodes: nextScopeCodes,
    languages: nextLanguages,
    locationCountry,
    worldwideRemote: profile.worldwideRemote,
    serviceCountries: profile.serviceCountries,
    profileLanguages: profile.languages,
  })
  if (invariant) {
    return secureJson(
      {
        error: "OFFER_INVARIANT_VIOLATION",
        code: invariant,
        message: MESSAGES[invariant],
      },
      { status: 422, headers }
    )
  }

  const mode = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const updated = await updateEventTypeMode(
        profile.orgId,
        modeId,
        eventTypeId,
        {
          ...(data.locationId !== undefined && {
            locationId: data.locationId ?? null,
          }),
          ...(data.scheduleId !== undefined && { scheduleId: nextScheduleId }),
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

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await deactivateEventTypeMode(profile.orgId, modeId, eventTypeId, tx)
      await ctx.emit({
        entity: "event_type_mode",
        action: "deleted",
        entityId: modeId,
        payload: { eventTypeId, soft: true },
      })
    }
  )

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PATCH, DELETE, OPTIONS"),
  })
}
