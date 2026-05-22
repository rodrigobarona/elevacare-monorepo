import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { ExpertOnboardingStepSchema } from "@eleva/api-client"
import { withAudit } from "@eleva/audit"
import { getExpertProfileByUserId, updateExpertProfile } from "@eleva/db"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ step: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:onboard")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const botVerdict = await checkBot()
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const { step: stepParam } = await params
  const parsedStep = ExpertOnboardingStepSchema.safeParse(stepParam)
  if (!parsedStep.success) {
    return secureJson(
      {
        error: "validation",
        issues: parsedStep.error.issues,
        message: `invalid step: ${stepParam}`,
      },
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

  const step = parsedStep.data
  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const steps = Array.isArray(completedSteps) ? [...completedSteps] : []
  if (!steps.includes(step)) steps.push(step)

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (_tx, ctx) => {
      await updateExpertProfile(profile.id, profile.orgId, {
        metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
      })
      await ctx.emit({
        entity: "expert_profile",
        action: "updated",
        entityId: profile.id,
        payload: { step, completedSteps: steps },
      })
    }
  )

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
