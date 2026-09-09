import {
  completeOnboarding,
  listAuthOrganizations,
  UnauthorizedError,
} from "@eleva/auth"
import { provisionOrgBilling } from "@eleva/billing/server"
import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({}).optional()

export async function POST(request: Request): Promise<Response> {
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
    RATE_LIMITS.onboarding
  )
  if (rateLimited) return rateLimited

  const body = BodySchema.safeParse(await request.json().catch(() => undefined))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const memberships = await listAuthOrganizations(
    session.user.id,
    session.orgId
  )
  const membership = memberships[0]
  if (!membership) {
    return secureJson({ hasMembership: false }, { headers })
  }

  const result = await completeOnboarding({
    userId: session.user.id,
    orgId: membership.orgId,
  })

  try {
    await provisionOrgBilling({
      orgId: result.orgId,
      orgName: membership.name,
      orgType: membership.orgType,
      email: session.user.email,
      actorUserId: session.user.id,
    })
  } catch (err) {
    console.error(
      "[onboarding/sync-existing] Billing provisioning failed:",
      err instanceof Error ? err.message : err
    )
  }

  return secureJson(
    {
      hasMembership: true,
      userId: result.userId,
      orgId: result.orgId,
      slug: result.slug,
    },
    { headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
