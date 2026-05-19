import { UnauthorizedError } from "@eleva/auth"
import type { CreateIdentitySessionResponse } from "@eleva/api-client"
import { createIdentityVerificationSession } from "@eleva/billing/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

/**
 * POST /stripe/identity
 *
 * Creates a Stripe Identity verification session for the currently
 * authenticated expert. Returns the client_secret that the embedded
 * Identity modal mounts with.
 *
 * Auth model (api-first per AGENTS.md): session-based (cookie) OR
 * Bearer token. Caller must hold the `expert:onboard` capability.
 *
 * The OpenAPI spec for this route lives in apps/api/src/lib/openapi.ts
 * (Zod schemas there generate the JSON spec consumers download).
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request): Promise<Response> {
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

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const expert = await getExpertProfileByUserId(session.user.id)
  if (!expert) {
    return secureJson({ error: "no_expert_profile" }, { status: 404, headers })
  }

  try {
    const result = await createIdentityVerificationSession({
      expertProfileId: expert.id,
      orgId: expert.orgId,
      stripeAccountId: expert.stripeAccountId ?? undefined,
    })
    return secureJson(
      {
        id: result.id,
        clientSecret: result.clientSecret,
        status: result.status,
      } satisfies CreateIdentitySessionResponse,
      { headers }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      "[stripe/identity] Verification session creation failed:",
      message
    )
    return secureJson(
      { error: "stripe_error", message },
      { status: 502, headers }
    )
  }
}
