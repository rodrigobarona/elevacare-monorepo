import { UnauthorizedError } from "@eleva/auth"
import {
  BillingPortalRequestSchema,
  type BillingPortalResponse,
} from "@eleva/api-client"
import {
  createBillingPortalSession,
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
  return `${base.replace(/\/$/, "")}/account/billing`
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

  const parsed = BillingPortalRequestSchema.safeParse(
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
    const result = await createBillingPortalSession({
      customerId: customer.stripeCustomerId,
      orgId: session.orgId,
      actorUserId: session.user.id,
      returnUrl: parsed.data.returnUrl ?? defaultReturnUrl(),
      configurationId: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID,
    })

    return secureJson(
      {
        id: result.id,
        url: result.url,
      } satisfies BillingPortalResponse,
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
