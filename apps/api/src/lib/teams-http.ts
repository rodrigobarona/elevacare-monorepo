import { z } from "zod"
import { ClinicError, type ClinicSummary } from "@eleva/auth"
import { TeamSummarySchema } from "@eleva/api-client"
import { describeError } from "@eleva/observability"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

const CLINIC_STATUS: Record<ClinicError["code"], number> = {
  CLINIC_NOT_FOUND: 404,
  VERIFICATION_LOCKED: 409,
  INVALID_TAX_ID: 422,
}

export type TeamCaller = { orgId: string; userId: string }

/**
 * Clinic admin auth shared by every /teams/{teamId} route: `clinic:manage`
 * in the active org, which must be the team in the path (a bearer agent
 * acts for one org at a time). Rate limited per user.
 */
export async function requireTeamCaller(
  request: Request,
  headers: Record<string, string>,
  rawTeamId: string
): Promise<TeamCaller | Response> {
  const teamId = z.string().uuid().safeParse(rawTeamId)
  if (!teamId.success) {
    return secureJson(
      { error: "invalid_params", issues: teamId.error.issues },
      { status: 422, headers }
    )
  }
  let session
  try {
    session = await requireApiCapability(request, "clinic:manage")
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }
  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited
  if (session.orgType !== "team" || session.orgId !== teamId.data) {
    return secureJson(
      { error: "forbidden", code: "TEAM_NOT_ACTIVE" },
      { status: 403, headers }
    )
  }
  return { orgId: session.orgId, userId: session.user.id }
}

export function teamResponse(
  summary: ClinicSummary,
  headers: Record<string, string>,
  status = 200
): Response {
  const { profile, verification } = summary
  return secureJson(
    TeamSummarySchema.parse({
      profile: {
        orgId: profile.orgId,
        slug: profile.slug,
        displayName: profile.displayName,
        description: profile.description,
        logoUrl: profile.logoUrl,
        websiteUrl: profile.websiteUrl,
        countryCode: profile.countryCode,
        billingAddress: profile.billingAddress,
        specialties: profile.specialties,
        payoutMode: profile.payoutMode,
      },
      verification: verification
        ? {
            id: verification.id,
            status: verification.status,
            legalName: verification.legalName,
            taxId: verification.taxId,
            submittedAt: verification.submittedAt.toISOString(),
            reviewedAt: verification.reviewedAt?.toISOString() ?? null,
            reason: verification.reason,
          }
        : null,
      verified: summary.verified,
    }),
    { status, headers }
  )
}

export function teamErrorResponse(
  err: unknown,
  headers: Record<string, string>,
  operation: string
): Response {
  if (err instanceof ClinicError) {
    return secureJson(
      { error: err.code },
      { status: CLINIC_STATUS[err.code], headers }
    )
  }
  console.error(`[teams] ${operation} failed`, describeError(err))
  return secureJson({ error: "internal" }, { status: 500, headers })
}
