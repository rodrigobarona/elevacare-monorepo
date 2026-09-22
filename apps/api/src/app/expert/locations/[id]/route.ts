import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  archivePracticeLocation,
  countModesUsingLocation,
  getExpertProfileByUserId,
  getPracticeLocation,
  listModeNamesUsingLocation,
  listPublishedActiveModesForExpert,
  updatePracticeLocation,
} from "@eleva/db"
import { validatePracticeAgainstPublishedModes } from "@eleva/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"))

const LocalizedTextSchema = z.object({
  en: z.string().min(1).max(2000),
  pt: z.string().min(1).max(2000).optional(),
  es: z.string().min(1).max(2000).optional(),
})

const PatchLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  line2: z.string().max(200).nullish(),
  city: z.string().min(1).max(100).optional(),
  region: z.string().max(100).nullish(),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase())
    .optional(),
  postalCode: z.string().max(20).nullish(),
  timezone: z
    .string()
    .refine((tz) => VALID_TIMEZONES.has(tz), {
      message: "Invalid IANA timezone",
    })
    .nullish(),
  instructions: LocalizedTextSchema.nullish(),
  isPrimary: z.boolean().optional(),
  active: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
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

  const location = await getPracticeLocation(profile.orgId, id, profile.id)
  if (!location) {
    return secureJson(
      { error: "not found", message: "location not found" },
      { status: 404, headers }
    )
  }

  return secureJson({ location }, { status: 200, headers })
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

  const body = PatchLocationSchema.safeParse(
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

  const existing = await getPracticeLocation(profile.orgId, id, profile.id)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "location not found" },
      { status: 404, headers }
    )
  }

  if (body.data.country) {
    const service = new Set(
      profile.serviceCountries.map((c) => c.toUpperCase())
    )
    if (!service.has(body.data.country)) {
      return secureJson(
        {
          error: "validation",
          message:
            "Location country must be one of your declared service countries.",
        },
        { status: 422, headers }
      )
    }
  }

  const deactivating = body.data.active === false && existing.active
  const countryChanging =
    body.data.country !== undefined &&
    body.data.country !== existing.country.toUpperCase()

  if (deactivating) {
    const modeCount = await countModesUsingLocation(profile.orgId, id)
    if (modeCount > 0) {
      const modes = await listModeNamesUsingLocation(profile.orgId, id)
      return secureJson(
        {
          error: "LOCATION_IN_USE",
          message:
            "This location is used by one or more delivery modes. Reassign those modes first.",
          modes,
        },
        { status: 409, headers }
      )
    }
  }

  if (countryChanging) {
    const publishedModes = await listPublishedActiveModesForExpert(
      profile.orgId,
      profile.id
    )
    const candidateCountry = body.data.country!
    const affected = publishedModes
      .filter((mode) => mode.locationId === id)
      .map((mode) => ({
        modeId: mode.modeId,
        eventTypeId: mode.eventTypeId,
        eventTypeTitle: mode.eventTypeTitle,
        kind: mode.kind,
        mode: mode.mode,
        countryScopeType: mode.countryScopeType,
        countryScopeCodes: mode.countryScopeCodes,
        languages: mode.languages,
        locationCountry: candidateCountry,
      }))

    const violations = validatePracticeAgainstPublishedModes({
      worldwideRemote: profile.worldwideRemote,
      serviceCountries: profile.serviceCountries,
      profileLanguages: profile.languages,
      modes: affected,
    })
    if (violations.length > 0) {
      return secureJson(
        { error: "OFFER_INVARIANT_VIOLATION", violations },
        { status: 409, headers }
      )
    }
  }

  const location = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const updated = await updatePracticeLocation(
        profile.orgId,
        id,
        profile.id,
        {
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.address !== undefined && {
            address: body.data.address,
          }),
          ...(body.data.line2 !== undefined && {
            line2: body.data.line2 ?? null,
          }),
          ...(body.data.city !== undefined && { city: body.data.city }),
          ...(body.data.region !== undefined && {
            region: body.data.region ?? null,
          }),
          ...(body.data.country !== undefined && {
            country: body.data.country,
          }),
          ...(body.data.postalCode !== undefined && {
            postalCode: body.data.postalCode ?? null,
          }),
          ...(body.data.timezone !== undefined && {
            timezone: body.data.timezone ?? null,
          }),
          ...(body.data.instructions !== undefined && {
            instructions: body.data.instructions ?? null,
          }),
          ...(body.data.isPrimary !== undefined && {
            isPrimary: body.data.isPrimary,
          }),
          ...(body.data.active !== undefined && { active: body.data.active }),
          ...(body.data.latitude !== undefined && {
            latitude: body.data.latitude ?? null,
          }),
          ...(body.data.longitude !== undefined && {
            longitude: body.data.longitude ?? null,
          }),
        },
        tx
      )
      await ctx.emit({
        entity: "expert_location",
        action: "updated",
        entityId: id,
        payload: { fields: Object.keys(body.data) },
      })
      return updated
    }
  )

  return secureJson({ location }, { status: 200, headers })
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

  const existing = await getPracticeLocation(profile.orgId, id, profile.id)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "location not found" },
      { status: 404, headers }
    )
  }

  const modeCount = await countModesUsingLocation(profile.orgId, id)
  if (modeCount > 0) {
    const modes = await listModeNamesUsingLocation(profile.orgId, id)
    return secureJson(
      {
        error: "LOCATION_IN_USE",
        message:
          "This location is used by one or more delivery modes. Reassign those modes first.",
        modes,
      },
      { status: 409, headers }
    )
  }

  const location = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const archived = await archivePracticeLocation(
        profile.orgId,
        id,
        profile.id,
        tx
      )
      await ctx.emit({
        entity: "expert_location",
        action: "deleted",
        entityId: id,
        payload: { archived: true },
      })
      return archived
    }
  )

  return secureJson({ location, archived: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PATCH, DELETE, OPTIONS"),
  })
}
