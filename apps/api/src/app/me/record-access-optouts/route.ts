import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { PutMeRecordAccessOptoutRequestSchema } from "@eleva/api-client"
import {
  listMemberRecordAccessChoices,
  MemberRecordAccessForbiddenError,
  setMemberRecordAccessOptout,
} from "@eleva/compliance"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function serializeChoices(
  choices: Awaited<ReturnType<typeof listMemberRecordAccessChoices>>
) {
  return {
    choices: choices.map((choice) => ({
      orgId: choice.orgId,
      orgName: choice.orgName,
      clinicSharedRecords: choice.clinicSharedRecords,
      optedOut: choice.optedOut,
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

  const choices = await listMemberRecordAccessChoices(session.user.id)
  return secureJson(serializeChoices(choices), { status: 200, headers })
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

  const body = PutMeRecordAccessOptoutRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const choices = await setMemberRecordAccessOptout({
      userId: session.user.id,
      orgId: body.data.orgId,
      optedOut: body.data.optedOut,
    })
    return secureJson(serializeChoices(choices), { status: 200, headers })
  } catch (err) {
    if (err instanceof MemberRecordAccessForbiddenError) {
      return secureJson(
        { error: "forbidden", code: err.code, message: err.message },
        { status: 403, headers }
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
