import { z } from "zod"
import { completeOnboarding, createElevaOrganization } from "@eleva/auth"
import { provisionOrgBilling } from "@eleva/billing/server"
import { LAST_ACTIVE_ORG_COOKIE } from "@eleva/config/routing"
import { LocaleSchema } from "@eleva/config/i18n"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requirePrivilegedApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({
  spaceName: z.string().min(2).max(100).trim(),
  locale: LocaleSchema.optional(),
})

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requirePrivilegedApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.onboarding
  )
  if (rateLimited) return rateLimited

  const body = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const created = await createElevaOrganization({
    userId: session.user.id,
    name: body.data.spaceName,
    type: "personal",
  })

  const result = await completeOnboarding({
    workosUserId: session.user.workosUserId,
    workosOrgId: created.orgId,
    orgName: body.data.spaceName,
    role: "admin",
    orgType: "personal",
    actorUserId: session.user.id,
  })

  try {
    await provisionOrgBilling({
      orgId: result.orgId,
      workosOrgId: created.orgId,
      orgName: body.data.spaceName,
      orgType: "personal",
      email: session.user.email,
    })
  } catch (err) {
    console.error(
      "[onboarding/complete] Billing provisioning failed (non-blocking):",
      err instanceof Error ? err.message : err
    )
  }

  headers["Set-Cookie"] =
    `${LAST_ACTIVE_ORG_COOKIE}=${encodeURIComponent(result.slug)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`

  return secureJson(
    {
      ok: true,
      userId: result.userId,
      orgId: result.orgId,
      slug: result.slug,
    },
    { status: 201, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
