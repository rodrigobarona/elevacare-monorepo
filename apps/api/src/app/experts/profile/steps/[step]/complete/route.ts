import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { getExpertProfileByUserId, updateExpertProfile } from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_STEPS = [
  "profile",
  "schedule",
  "event-types",
  "calendars",
  "invoicing",
  "review",
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ step: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const { step } = await params
  if (!VALID_STEPS.includes(step)) {
    return secureJson(
      { error: "validation", message: `invalid step: ${step}` },
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

  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const steps = Array.isArray(completedSteps) ? [...completedSteps] : []
  if (!steps.includes(step)) steps.push(step)

  await updateExpertProfile(profile.id, profile.orgId, {
    metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
  })

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
