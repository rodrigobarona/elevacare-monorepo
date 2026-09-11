import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { PutMeConsentRequestSchema } from "@eleva/api-client"
import {
  listMemberConsents,
  MemberConsentConflictError,
  updateMemberConsent,
} from "@eleva/compliance"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function serializeConsents(
  consents: Awaited<ReturnType<typeof listMemberConsents>>
) {
  return {
    consents: consents.map((consent) => ({
      kind: consent.kind,
      version: consent.version,
      grantedAt: consent.grantedAt ? consent.grantedAt.toISOString() : null,
      withdrawnAt: consent.withdrawnAt
        ? consent.withdrawnAt.toISOString()
        : null,
      source: consent.source,
    })),
  }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, OPTIONS")

  let session
  try {
    session = await requireMemberApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const consents = await listMemberConsents(session.user.id)
  return secureJson(serializeConsents(consents), { status: 200, headers })
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, OPTIONS")

  let session
  try {
    session = await requireMemberApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = PutMeConsentRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const consents = await updateMemberConsent({
      userId: session.user.id,
      orgId: session.orgId,
      kind: body.data.kind,
      granted: body.data.granted,
      version: body.data.version,
      locale: body.data.locale,
    })
    return secureJson(serializeConsents(consents), { status: 200, headers })
  } catch (err) {
    if (err instanceof MemberConsentConflictError) {
      return secureJson(
        { error: "conflict", code: err.code, message: err.message },
        { status: 409, headers }
      )
    }
    throw err
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PUT, OPTIONS"),
  })
}
