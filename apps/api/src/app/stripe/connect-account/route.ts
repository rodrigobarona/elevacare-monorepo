import { UnauthorizedError } from "@eleva/auth"
import {
  CreateConnectAccountRequestSchema,
  type CreateConnectAccountResponse,
} from "@eleva/api-client"
import { provisionConnectAccount } from "@eleva/billing/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { checkBot } from "@/lib/bot-protection"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

/**
 * POST /stripe/connect-account
 *
 * Provisions a Stripe Connect Express account for the authenticated
 * expert when Payments onboarding has no stripeAccountId yet.
 *
 * Auth: session or Bearer. Caller must hold `expert:onboard`.
 * Stripe create is outside any DB transaction; persist is withAudit.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson(
        { error: "unauthorized", code: err.code },
        { status: 401, headers }
      )
    }
    throw err
  }

  if (!session.capabilities.includes("expert:onboard")) {
    return secureJson(
      { error: "forbidden", code: "missing-capability" },
      { status: 403, headers }
    )
  }

  if (
    session.authMode !== "bearer" &&
    session.authMode !== "jwt" &&
    session.authMode !== "api-key"
  ) {
    const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
    if (botVerdict?.isBot) {
      return secureJson({ error: "blocked" }, { status: 403, headers })
    }
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  const parsed = CreateConnectAccountRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const expert = await getExpertProfileByUserId(session.user.id)
  if (!expert) {
    return secureJson({ error: "no_expert_profile" }, { status: 404, headers })
  }

  const country = expert.practiceCountry.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) {
    return secureJson(
      {
        error: "validation",
        message: "Practice country is required before Payments onboarding",
      },
      { status: 422, headers }
    )
  }

  try {
    const result = await provisionConnectAccount({
      expertProfileId: expert.id,
      orgId: expert.orgId,
      email: session.user.email,
      country,
      businessType: parsed.data.businessType,
      actorUserId: session.user.id,
    })
    return secureJson(
      {
        stripeAccountId: result.stripeAccountId,
        created: result.created,
        detailsSubmitted: result.detailsSubmitted,
        payoutsEnabled: result.payoutsEnabled,
      } satisfies CreateConnectAccountResponse,
      { headers }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[stripe/connect-account] provision failed:", message)
    return secureJson(
      {
        error: "stripe_error",
        message: "Could not provision Payments account",
      },
      { status: 502, headers }
    )
  }
}
