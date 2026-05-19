import { UnauthorizedError } from "@eleva/auth"
import {
  BillingCheckoutRequestSchema,
  type BillingCheckoutResponse,
} from "@eleva/api-client"
import {
  createSubscriptionCheckoutSession,
  getBillingCustomerForOrg,
} from "@eleva/billing/server"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function defaultReturnUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://eleva.care"
  return `${base.replace(/\/$/, "")}/account/billing/return?checkout_session_id={CHECKOUT_SESSION_ID}`
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

  const canManageBilling =
    session.capabilities.includes("billing:manage_org") ||
    session.capabilities.includes("subscriptions:manage_org")
  if (!canManageBilling) {
    return secureJson(
      { error: "forbidden", code: "missing-capability" },
      { status: 403, headers }
    )
  }

  const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const parsed = BillingCheckoutRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const customer = await getBillingCustomerForOrg(session.orgId)
  if (!customer) {
    return secureJson(
      {
        error: "no_stripe_customer",
        message: "Organization does not have a Stripe customer.",
      },
      { status: 409, headers }
    )
  }

  try {
    const result = await createSubscriptionCheckoutSession({
      customerId: customer.stripeCustomerId,
      workosOrgId: customer.workosOrgId,
      orgId: session.orgId,
      actorUserId: session.user.id,
      tier: parsed.data.tier,
      quantity: parsed.data.quantity,
      returnUrl: parsed.data.returnUrl ?? defaultReturnUrl(),
    })

    return secureJson(
      {
        sessionId: result.id,
        clientSecret: result.clientSecret,
      } satisfies BillingCheckoutResponse,
      { headers }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { error: "stripe_error", message },
      { status: 502, headers }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
