import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { ExpertOnboardingStepSchema } from "@eleva/api-client"
import { withAudit } from "@eleva/audit"
import { isExpertInvoicingChoiceComplete } from "@eleva/auth"
import {
  getExpertProfileByUserId,
  getOrCreateDefaultSchedule,
  main,
  updateExpertProfile,
} from "@eleva/db"
import { eq } from "drizzle-orm"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import type { RoutePolicy } from "@/lib/route-policy"

function isPracticeScopeComplete(profile: {
  practiceCountry: string
  languages: string[]
  metadata: Record<string, unknown> | null
}): boolean {
  const declaredAt = profile.metadata?.practiceDeclaredAt
  return (
    typeof declaredAt === "string" &&
    declaredAt.length > 0 &&
    Boolean(profile.practiceCountry?.trim()) &&
    profile.languages.length >= 1
  )
}

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

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
  if (
    step === "practice" &&
    !isPracticeScopeComplete({
      practiceCountry: profile.practiceCountry,
      languages: profile.languages,
      metadata: (profile.metadata as Record<string, unknown> | null) ?? null,
    })
  ) {
    return secureJson(
      {
        error: "PRACTICE_INCOMPLETE",
        message:
          "Save Practice (country and languages) before completing this step",
      },
      { status: 409, headers }
    )
  }
  if (
    (step === "invoicing" || step === "schedule") &&
    !isExpertInvoicingChoiceComplete(profile.invoicingSetupStatus)
  ) {
    return secureJson(
      {
        error: "invoicing_required",
        message:
          "Become-Partner cannot complete without Auto invoicing or Manual acknowledgment",
      },
      { status: 409, headers }
    )
  }
  if (
    step === "schedule" &&
    !isPracticeScopeComplete({
      practiceCountry: profile.practiceCountry,
      languages: profile.languages,
      metadata: (profile.metadata as Record<string, unknown> | null) ?? null,
    })
  ) {
    return secureJson(
      {
        error: "PRACTICE_INCOMPLETE",
        message:
          "Complete the Practice step (country and languages) before finishing onboarding",
      },
      { status: 409, headers }
    )
  }

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      if (step === "schedule") {
        await getOrCreateDefaultSchedule(
          profile.orgId,
          profile.id,
          profile.timezone ?? "Europe/Lisbon",
          tx
        )
      }
      const [fresh] = await tx
        .select({ metadata: main.expertProfiles.metadata })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.id, profile.id))
        .limit(1)
      const currentMeta =
        (fresh?.metadata as Record<string, unknown> | null) ?? {}
      const completedSteps = currentMeta.completedSteps
      const steps = Array.isArray(completedSteps) ? [...completedSteps] : []
      if (!steps.includes(step)) steps.push(step)

      await updateExpertProfile(
        profile.id,
        profile.orgId,
        {
          metadata: { ...currentMeta, completedSteps: steps },
        },
        tx
      )
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
