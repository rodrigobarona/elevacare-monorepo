import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  createPracticeLocation,
  getExpertProfileByUserId,
  listPracticeLocations,
} from "@eleva/db"
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

const CreateLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  line2: z.string().max(200).nullish(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).nullish(),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase()),
  postalCode: z.string().max(20).nullish(),
  timezone: z
    .string()
    .refine((tz) => VALID_TIMEZONES.has(tz), {
      message: "Invalid IANA timezone",
    })
    .nullish(),
  instructions: LocalizedTextSchema.nullish(),
  isPrimary: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
})

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")

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

  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "true"
  const locations = await listPracticeLocations(profile.orgId, profile.id, {
    includeInactive,
  })

  return secureJson({ locations }, { status: 200, headers })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")

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

  const body = CreateLocationSchema.safeParse(
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

  const service = new Set(profile.serviceCountries.map((c) => c.toUpperCase()))
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

  const location = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const created = await createPracticeLocation(
        profile.orgId,
        {
          expertProfileId: profile.id,
          name: body.data.name,
          address: body.data.address,
          line2: body.data.line2 ?? null,
          city: body.data.city,
          region: body.data.region ?? null,
          country: body.data.country,
          postalCode: body.data.postalCode ?? null,
          timezone: body.data.timezone ?? null,
          instructions: body.data.instructions ?? null,
          isPrimary: body.data.isPrimary ?? false,
          latitude: body.data.latitude ?? null,
          longitude: body.data.longitude ?? null,
          active: true,
        },
        tx
      )
      await ctx.emit({
        entity: "expert_location",
        action: "created",
        entityId: created.id,
        payload: { country: created.country, city: created.city },
      })
      return created
    }
  )

  return secureJson({ location }, { status: 201, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, OPTIONS"),
  })
}
