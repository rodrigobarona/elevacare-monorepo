import {
  hasFinishedExpertSetup,
  PatchPracticeRequestSchema,
} from "@eleva/api-client"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  getExpertProfileByUserId,
  listPublishedActiveModesForExpert,
  main,
  updateExpertProfile,
} from "@eleva/db"
import { validatePracticeAgainstPublishedModes } from "@eleva/scheduling"
import { eq } from "drizzle-orm"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PatchPracticeSchema = PatchPracticeRequestSchema.superRefine(
  (value, ctx) => {
    if (value.practiceCountry && value.serviceCountries) {
      if (!value.serviceCountries.includes(value.practiceCountry)) {
        ctx.addIssue({
          code: "custom",
          message: "serviceCountries must include practiceCountry",
          path: ["serviceCountries"],
        })
      }
    }
  }
)

const LICENCE_FIELDS = [
  "professionalBody",
  "licenceNumber",
  "ersRegistrationNumber",
] as const

function practicePayload(profile: {
  id: string
  practiceCountry: string
  serviceCountries: string[]
  languages: string[]
  licenseScope: string | null
  professionalBody: string | null
  licenceNumber: string | null
  ersRegistrationNumber: string | null
  worldwideRemote: boolean
  acceptingBookings: boolean
}) {
  return {
    id: profile.id,
    practiceCountry: profile.practiceCountry,
    serviceCountries: profile.serviceCountries,
    languages: profile.languages,
    licenseScope: profile.licenseScope,
    professionalBody: profile.professionalBody,
    licenceNumber: profile.licenceNumber,
    ersRegistrationNumber: profile.ersRegistrationNumber,
    worldwideRemote: profile.worldwideRemote,
    acceptingBookings: profile.acceptingBookings,
  }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, PATCH, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:onboard")
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

  return secureJson(
    { practice: practicePayload(profile) },
    { status: 200, headers }
  )
}

export async function PATCH(request: Request) {
  const headers = corsHeaders(request, "GET, PATCH, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:onboard")
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

  const body = PatchPracticeSchema.safeParse(
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

  // Practice carries the licence only during setup. A listed or filed profile
  // sends licence changes for staff review via POST /expert/profile/licence-application
  // (which refuses once verified), so they never go live unverified.
  const licenceChanged = LICENCE_FIELDS.some(
    (field) => data[field] !== undefined && data[field] !== profile[field]
  )
  const licenceLocked =
    profile.status === "active" ||
    (profile.status === "approved" &&
      hasFinishedExpertSetup(
        profile.metadata as Record<string, unknown> | null
      ))
  if (licenceChanged && licenceLocked) {
    return secureJson(
      {
        error: "LICENCE_LOCKED",
        message:
          "Listed profiles change their licence through POST /expert/profile/licence-application",
      },
      { status: 409, headers }
    )
  }

  const nextPracticeCountry = data.practiceCountry ?? profile.practiceCountry
  const nextServiceCountries = (
    data.serviceCountries ?? profile.serviceCountries
  ).map((c) => c.toUpperCase())
  if (!nextServiceCountries.includes(nextPracticeCountry.toUpperCase())) {
    nextServiceCountries.push(nextPracticeCountry.toUpperCase())
  }
  const nextLanguages = data.languages ?? profile.languages
  const nextWorldwideRemote = data.worldwideRemote ?? profile.worldwideRemote

  const publishedModes = await listPublishedActiveModesForExpert(
    profile.orgId,
    profile.id
  )
  const violations = validatePracticeAgainstPublishedModes({
    worldwideRemote: nextWorldwideRemote,
    serviceCountries: nextServiceCountries,
    profileLanguages: nextLanguages,
    modes: publishedModes.map((mode) => ({
      modeId: mode.modeId,
      eventTypeId: mode.eventTypeId,
      eventTypeTitle: mode.eventTypeTitle,
      kind: mode.kind,
      mode: mode.mode,
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      locationCountry: mode.locationCountry,
    })),
  })

  if (violations.length > 0) {
    return secureJson(
      {
        error: "OFFER_INVARIANT_VIOLATION",
        violations,
      },
      { status: 409, headers }
    )
  }

  // Explicit Practice declaration: both country and languages must be in this
  // request body (not merely schema defaults on the row).
  const isExplicitPracticeDeclaration =
    data.practiceCountry !== undefined && data.languages !== undefined

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      let metadata: Record<string, unknown> | undefined
      if (isExplicitPracticeDeclaration) {
        const [fresh] = await tx
          .select({ metadata: main.expertProfiles.metadata })
          .from(main.expertProfiles)
          .where(eq(main.expertProfiles.id, profile.id))
          .limit(1)
          .for("update")
        metadata = {
          ...((fresh?.metadata as Record<string, unknown> | null) ?? {}),
          practiceDeclaredAt: new Date().toISOString(),
        }
      }

      await updateExpertProfile(
        profile.id,
        profile.orgId,
        {
          ...(data.practiceCountry !== undefined && {
            practiceCountry: data.practiceCountry,
            practiceCountries: nextServiceCountries,
            serviceCountries: nextServiceCountries,
          }),
          ...(data.serviceCountries !== undefined && {
            serviceCountries: nextServiceCountries,
            practiceCountries: nextServiceCountries,
          }),
          ...(data.languages !== undefined && { languages: data.languages }),
          ...(data.licenseScope !== undefined && {
            licenseScope: data.licenseScope ?? null,
          }),
          ...(data.professionalBody !== undefined && {
            professionalBody: data.professionalBody,
          }),
          ...(data.licenceNumber !== undefined && {
            licenceNumber: data.licenceNumber,
          }),
          ...(data.ersRegistrationNumber !== undefined && {
            ersRegistrationNumber: data.ersRegistrationNumber,
          }),
          ...(data.worldwideRemote !== undefined && {
            worldwideRemote: data.worldwideRemote,
            worldwideMode: data.worldwideRemote,
          }),
          ...(data.acceptingBookings !== undefined && {
            acceptingBookings: data.acceptingBookings,
          }),
          ...(metadata !== undefined && { metadata }),
        },
        tx
      )
      await ctx.emit({
        entity: "expert_profile",
        action: "updated",
        entityId: profile.id,
        payload: {
          fields: Object.keys(data),
          surface: "practice",
          ...(isExplicitPracticeDeclaration && { practiceDeclared: true }),
        },
      })
    }
  )

  const updated = await getExpertProfileByUserId(session.user.id)
  return secureJson(
    { practice: practicePayload(updated ?? profile) },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PATCH, OPTIONS"),
  })
}
