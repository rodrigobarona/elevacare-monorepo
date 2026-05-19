import { z } from "zod"
import { completeOnboarding } from "@eleva/auth"
import { getWorkOS } from "@eleva/auth/server"
import { provisionOrgBilling } from "@eleva/billing/server"
import { LAST_ACTIVE_ORG_COOKIE } from "@eleva/config/routing"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { UnauthorizedError } from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({
  spaceName: z.string().min(2).max(100).trim(),
  locale: z.string().min(2).max(10).optional(),
})

export async function POST(request: Request) {
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

  const workos = getWorkOS()

  const org = await workos.organizations.createOrganization({
    name: body.data.spaceName,
  })

  await workos.userManagement.createOrganizationMembership({
    userId: session.user.workosUserId,
    organizationId: org.id,
    roleSlug: "admin",
  })

  const result = await completeOnboarding({
    workosUserId: session.user.workosUserId,
    workosOrgId: org.id,
    orgName: body.data.spaceName,
    role: "admin",
    orgType: "personal",
    actorUserId: session.user.id,
  })

  const settled = await Promise.allSettled([
    workos.userManagement.updateUser({
      userId: session.user.workosUserId,
      externalId: result.userId,
      ...(body.data.locale && { locale: body.data.locale }),
    }),
    workos.organizations.updateOrganization({
      organization: org.id,
      externalId: result.orgId,
      metadata: { slug: result.slug, org_type: "personal" },
    }),
  ])

  const failures = settled.filter(
    (s): s is PromiseRejectedResult => s.status === "rejected"
  )
  if (failures.length > 0) {
    for (const f of failures) {
      console.error("[onboarding/complete] WorkOS update failed:", f.reason)
    }
    return secureJson(
      {
        error: "partial_failure",
        message: "Onboarding completed but WorkOS sync failed",
        userId: result.userId,
        orgId: result.orgId,
        slug: result.slug,
      },
      { status: 207, headers }
    )
  }

  try {
    await provisionOrgBilling({
      orgId: result.orgId,
      workosOrgId: org.id,
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
