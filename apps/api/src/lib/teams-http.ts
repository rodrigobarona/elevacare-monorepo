import { z } from "zod"
import {
  ClinicError,
  TeamMemberError,
  type ClinicSummary,
  type TeamMemberErrorCode,
} from "@eleva/auth"
import { TeamSummarySchema } from "@eleva/api-client"
import { describeError } from "@eleva/observability"
import {
  apiAuthFailure,
  requireApiCapability,
  requireRevocableApiCapability,
} from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

const CLINIC_STATUS: Record<ClinicError["code"], number> = {
  CLINIC_NOT_FOUND: 404,
  VERIFICATION_LOCKED: 409,
  VERIFICATION_UNCHANGED: 409,
  INVALID_TAX_ID: 422,
}

const TEAM_MEMBER_STATUS: Record<TeamMemberErrorCode, number> = {
  ALREADY_MEMBER: 409,
  MEMBER_LIMIT_REACHED: 409,
  MEMBER_NOT_FOUND: 404,
  INVITATION_NOT_FOUND: 404,
  INVITATION_RECENTLY_SENT: 429,
  INVITATION_DECLINED: 409,
  INVITATION_DAILY_LIMIT: 429,
  OWNER_REQUIRED: 403,
  MANAGER_REQUIRED: 403,
  CANNOT_REMOVE_OWNER: 409,
  CANNOT_REMOVE_SELF: 409,
  MEMBER_HAS_UPCOMING_SESSIONS: 409,
}

export type TeamCaller = { orgId: string; userId: string }

/** What a /teams route asks of its caller. */
type TeamCapability = "clinic:manage" | "members:manage"

/**
 * Clinic admin auth shared by every /teams/{teamId} route: the capability
 * (`clinic:manage` unless the route names another) in the active org, which
 * must be the team in the path (a bearer agent acts for one org at a time).
 * Rate limited per user.
 */
export async function requireTeamCaller(
  request: Request,
  headers: Record<string, string>,
  rawTeamId: string,
  /** Writes need a revocable session or key (no bare JWT). */
  options: { mutation?: boolean; capability?: TeamCapability } = {}
): Promise<TeamCaller | Response> {
  const capability = options.capability ?? "clinic:manage"
  const teamId = z.string().uuid().safeParse(rawTeamId)
  if (!teamId.success) {
    return secureJson(
      { error: "validation", issues: teamId.error.issues },
      { status: 422, headers }
    )
  }
  let session
  try {
    session = options.mutation
      ? await requireRevocableApiCapability(request, capability)
      : await requireApiCapability(request, capability)
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
  if (err instanceof TeamMemberError) {
    return secureJson(
      {
        error: err.code,
        code: err.code,
        ...err.detail,
      },
      {
        status: TEAM_MEMBER_STATUS[err.code],
        headers:
          err.detail.retryAfterSeconds === undefined
            ? headers
            : {
                ...headers,
                "Retry-After": String(err.detail.retryAfterSeconds),
              },
      }
    )
  }
  console.error(`[teams] ${operation} failed`, describeError(err))
  return secureJson({ error: "internal" }, { status: 500, headers })
}
