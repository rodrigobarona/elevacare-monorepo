import {
  describeError,
  recordLogger,
  RecordTemplateError,
  SessionRecordError,
} from "@eleva/records"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

const TEMPLATE_STATUS: Record<RecordTemplateError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  PHI_DETECTED: 422,
}

const SESSION_STATUS: Record<SessionRecordError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTAKE_READONLY: 409,
  AI_MODEL_ZERO_RETENTION_REQUIRED: 409,
  NOT_PUBLISHABLE: 409,
}

export type TemplateCaller = { orgId: string; userId: string }

/** Expert-org auth + rate limit shared by every /records/templates route. */
export async function requireTemplateCaller(
  request: Request,
  headers: Record<string, string>
): Promise<TemplateCaller | Response> {
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

export function templateErrorResponse(
  err: unknown,
  headers: Record<string, string>,
  operation: string
): Response {
  if (err instanceof RecordTemplateError) {
    const body =
      err.code === "PHI_DETECTED"
        ? {
            error: err.code,
            findings: err.findings.map(({ field, detector, start, end }) => ({
              field,
              detector,
              start,
              end,
            })),
          }
        : { error: err.code }
    return secureJson(body, { status: TEMPLATE_STATUS[err.code], headers })
  }
  if (err instanceof SessionRecordError) {
    return secureJson(
      { error: err.code },
      { status: SESSION_STATUS[err.code], headers }
    )
  }
  recordLogger.error(`record template ${operation} failed`, {
    status: describeError(err),
  })
  return secureJson({ error: "internal" }, { status: 500, headers })
}
