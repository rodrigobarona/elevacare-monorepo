import { CrmError } from "@eleva/crm"
import { describeError, recordLogger } from "@eleva/records"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

const CRM_STATUS: Record<CrmError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NOT_A_LEAD: 409,
  MEMBER_NOT_FOUND: 404,
}

export type CrmCaller = { orgId: string; userId: string }

/** Expert-org auth + rate limit shared by every /crm route. */
export async function requireCrmCaller(
  request: Request,
  headers: Record<string, string>
): Promise<CrmCaller | Response> {
  let session
  try {
    session = await requireApiCapability(request, "events:manage")
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
  return { orgId: session.orgId, userId: session.user.id }
}

export function crmErrorResponse(
  err: unknown,
  headers: Record<string, string>,
  operation: string
): Response {
  if (err instanceof CrmError) {
    return secureJson(
      { error: err.code },
      { status: CRM_STATUS[err.code], headers }
    )
  }
  recordLogger.error(`crm ${operation} failed`, {
    status: describeError(err),
  })
  return secureJson({ error: "internal" }, { status: 500, headers })
}

export function invalid(
  kind: "invalid_body" | "invalid_query",
  issues: unknown,
  headers: Record<string, string>
): Response {
  return secureJson({ error: kind, issues }, { status: 422, headers })
}
