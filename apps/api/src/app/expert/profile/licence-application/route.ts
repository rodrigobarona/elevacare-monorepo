import {
  ExpertLicenceApplicationResponseSchema,
  ExpertLicenceSchema,
  hasFinishedExpertSetup,
} from "@eleva/api-client"
import { withAudit } from "@eleva/audit"
import type { ElevaSession } from "@eleva/auth"
import {
  getExpertProfileByUserId,
  getLatestPartnerApplication,
  updateExpertProfile,
  type main,
} from "@eleva/db"
import { _submitPartnerApplication } from "@eleva/db/queries/partner-applications"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "GET, POST, OPTIONS"

function toResponse(application: main.BecomePartnerApplication | null) {
  return ExpertLicenceApplicationResponseSchema.parse({
    application: application
      ? {
          id: application.id,
          status: application.status,
          professionalBody: application.professionalBody,
          licenceNumber: application.licenceNumber,
          ersRegistrationNumber: application.ersRegistrationNumber,
          submittedAt: application.submittedAt.toISOString(),
          reviewedAt: application.reviewedAt?.toISOString() ?? null,
          reason: application.reason,
        }
      : null,
  })
}

type Authorized =
  | { session: ElevaSession; response?: never }
  | { session?: never; response: Response }

async function authorize(
  request: Request,
  headers: Record<string, string>
): Promise<Authorized> {
  let session: ElevaSession
  try {
    session = await requireApiCapability(request, "expert:onboard")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return { response: authFailure }
    throw err
  }
  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  return rateLimited ? { response: rateLimited } : { session }
}

/** The expert's latest licence verification application, or null. */
export async function GET(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const auth = await authorize(request, headers)
  if (auth.response) return auth.response

  const profile = await getExpertProfileByUserId(auth.session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }
  const application = await getLatestPartnerApplication(
    profile.orgId,
    profile.id
  )
  return secureJson(toResponse(application), { status: 200, headers })
}

/**
 * Submit or resubmit the licence for staff verification after setup:
 * a finished `approved` profile (resubmit after needs_changes / rejected)
 * or an `active` profile that was never verified. The profile status does
 * not change here; only staff approval lists or keeps it listed.
 */
export async function POST(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const auth = await authorize(request, headers)
  if (auth.response) return auth.response
  const { session } = auth

  const body = ExpertLicenceSchema.safeParse(
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

  const latest = await getLatestPartnerApplication(profile.orgId, profile.id)
  if (latest?.status === "approved") {
    return secureJson(
      {
        error: "LICENCE_LOCKED",
        message:
          "Your licence is already verified. Contact support@eleva.care to change it.",
      },
      { status: 409, headers }
    )
  }
  const finishedSetup = hasFinishedExpertSetup(
    profile.metadata as Record<string, unknown> | null
  )
  const eligible =
    profile.status === "active" ||
    (profile.status === "approved" && finishedSetup)
  if (!eligible) {
    return secureJson(
      profile.status === "approved"
        ? {
            error: "SETUP_INCOMPLETE",
            message: "Finish setup to submit your licence for verification",
          }
        : {
            error: "PROFILE_NOT_ELIGIBLE",
            message: `A ${profile.status} profile cannot submit a licence`,
          },
      { status: 409, headers }
    )
  }

  const application = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await updateExpertProfile(profile.id, profile.orgId, body.data, tx)
      const { application, refreshed } = await _submitPartnerApplication(tx, {
        orgId: profile.orgId,
        expertProfileId: profile.id,
        licence: body.data,
      })
      await ctx.emit({
        entity: "partner_application",
        action: "submitted",
        entityId: application.id,
        payload: {
          expertProfileId: profile.id,
          professionalBody: application.professionalBody,
          profileStatus: profile.status,
          refreshed,
          surface: "licence",
        },
      })
      return application
    }
  )

  return secureJson(toResponse(application), {
    status: 201,
    headers,
  })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
