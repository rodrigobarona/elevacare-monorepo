import { z } from "zod"
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

const countryCode = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase())

const CreateModeSchema = z
  .object({
    mode: z.enum(["online", "phone", "in_person"]),
    locationId: z.string().uuid().nullish(),
    scheduleId: z.string().uuid(),
    priceCents: z.number().int().nonnegative().nullish(),
    currency: z.literal("EUR").nullish(),
    durationMinutes: z.number().int().positive().nullish(),
    countryScopeType: z.enum(["worldwide", "list"]),
    countryScopeCodes: z.array(countryCode).default([]),
    languages: z.array(z.string().min(2).max(16)).min(1),
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
    if (value.mode === "in_person" && !value.locationId) {
      ctx.addIssue({
        code: "custom",
        message: "In-person modes need a practice location.",
        path: ["locationId"],
      })
    }
    if (value.mode !== "in_person" && value.locationId) {
      ctx.addIssue({
        code: "custom",
        message: "Only in-person modes may set a location.",
        path: ["locationId"],
      })
    }
    if (
      value.countryScopeType === "worldwide" &&
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
      value.countryScopeCodes.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "List scope needs at least one country.",
        path: ["countryScopeCodes"],
      })
    }
    if ((value.priceCents == null) !== (value.currency == null)) {
      ctx.addIssue({
        code: "custom",
        message: "priceCents and currency must both be set or both omitted.",
        path: ["priceCents"],
      })
    }
  })

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

  const body = CreateModeSchema.safeParse(
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
  const schedule = await getSchedule(profile.orgId, data.scheduleId, profile.id)
  if (!schedule) {
    return secureJson(
      { error: "validation", message: "Schedule not found for this expert." },
      { status: 422, headers }
    )
  }

  let locationCountry: string | null = null
  if (data.locationId) {
    const location = await getPracticeLocation(
      profile.orgId,
      data.locationId,
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
  }

  const invariant = assertOfferInvariants({
    kind: eventType.kind,
    mode: data.mode,
    countryScopeType: data.countryScopeType,
    countryScopeCodes: data.countryScopeCodes,
    languages: data.languages,
    locationCountry,
    worldwideRemote: profile.worldwideRemote,
    serviceCountries: profile.serviceCountries,
    profileLanguages: profile.languages,
  })
  if (invariant) {
    const messages: Record<OfferInvariantError, string> = {
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
    return secureJson(
      {
        error: "OFFER_INVARIANT_VIOLATION",
        code: invariant,
        message: messages[invariant],
      },
      { status: 422, headers }
    )
  }

  const mode = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
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

  return secureJson({ mode }, { status: 201, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, OPTIONS"),
  })
}
