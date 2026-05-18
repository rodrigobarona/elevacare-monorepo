import { z } from "zod"
import { UnauthorizedError } from "@eleva/auth"
import {
  createOrgSubscription,
  swapSubscriptionTier,
  stripe,
} from "@eleva/billing/server"
import { secureJson } from "../../../lib/security-headers"
import { corsHeaders } from "../../../lib/cors"
import { requireApiAuth } from "../../../lib/auth"
import {
  applyRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from "../../../lib/rate-limit"

/**
 * POST /billing/subscribe
 *
 * Creates or upgrades a subscription for the authenticated user's
 * current organization. The org must already have a Stripe Customer
 * (set during provisioning via provisionOrgBilling).
 *
 * Auth model: session-based (cookie) or Bearer token.
 * The user must hold `billing:manage_org` or `subscriptions:manage_org` capability.
 *
 * Request body:
 *   { tier: "clinic_starter" | "clinic_growth" | "expert_top", quantity?: number }
 *
 * Response:
 *   { subscriptionId, status, clientSecret? }
 *
 * If the subscription requires payment, a `clientSecret` is returned
 * for the Payment Element to confirm on the client.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const requestSchema = z.object({
  tier: z.enum([
    "expert_community",
    "expert_top",
    "clinic_starter",
    "clinic_growth",
  ]),
  quantity: z.number().int().min(1).max(100).optional(),
})

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

  const canManageBilling =
    session.capabilities.includes("billing:manage_org") ||
    session.capabilities.includes("subscriptions:manage_org")

  if (!canManageBilling) {
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

  let body: z.infer<typeof requestSchema>
  try {
    const raw = await request.json()
    body = requestSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return secureJson(
        { error: "validation", issues: err.issues },
        { status: 422, headers }
      )
    }
    return secureJson(
      { error: "validation", issues: [{ message: "invalid-json" }] },
      { status: 422, headers }
    )
  }

  const { tier, quantity } = body

  try {
    const s = stripe()
    const customers = await s.customers.search({
      query: `metadata["workos_org_id"]:"${session.workosOrgId}"`,
    })

    const customer = customers.data[0]
    if (!customer) {
      return secureJson(
        {
          error: "no_stripe_customer",
          message:
            "Organization does not have a Stripe customer. Contact support.",
        },
        { status: 409, headers }
      )
    }

    const subscriptions = await s.subscriptions.list({
      customer: customer.id,
      status: "active" as unknown as undefined,
      limit: 5,
    })

    const incompleteSubscriptions = await s.subscriptions.list({
      customer: customer.id,
      status: "incomplete" as unknown as undefined,
      limit: 5,
    })

    const trialingSubscriptions = await s.subscriptions.list({
      customer: customer.id,
      status: "trialing" as unknown as undefined,
      limit: 5,
    })

    const allSubs = [
      ...subscriptions.data,
      ...incompleteSubscriptions.data,
      ...trialingSubscriptions.data,
    ]
    const existingSub = allSubs[0]

    if (existingSub) {
      const updated = await swapSubscriptionTier({
        subscriptionId: existingSub.id,
        newTier: tier,
        quantity,
      })

      if (!updated) {
        return secureJson(
          {
            error: "tier_not_found",
            message: `Product for tier '${tier}' not found in Stripe.`,
          },
          { status: 404, headers }
        )
      }

      const clientSecret = await extractClientSecret(s, updated.latest_invoice)

      return secureJson(
        {
          subscriptionId: updated.id,
          status: updated.status,
          clientSecret,
        },
        { headers }
      )
    }

    const subscription = await createOrgSubscription({
      customerId: customer.id,
      tier,
      quantity,
    })

    if (!subscription) {
      return secureJson(
        {
          error: "tier_not_found",
          message: `Product for tier '${tier}' not found in Stripe.`,
        },
        { status: 404, headers }
      )
    }

    const clientSecret = await extractClientSecret(
      s,
      subscription.latest_invoice
    )

    return secureJson(
      {
        subscriptionId: subscription.id,
        status: subscription.status,
        clientSecret,
      },
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

/**
 * Extracts the PaymentIntent client_secret from a subscription's latest invoice.
 * Returns null if the invoice is free (no payment required) or already paid.
 */
async function extractClientSecret(
  s: ReturnType<typeof stripe>,
  latestInvoice: unknown
): Promise<string | null> {
  if (!latestInvoice) return null

  const invoiceId =
    typeof latestInvoice === "string"
      ? latestInvoice
      : (latestInvoice as { id?: string }).id

  if (!invoiceId) return null

  const invoice = await s.invoices.retrieve(invoiceId, {
    expand: ["payment_intent"],
  })

  const raw = invoice as unknown as Record<string, unknown>
  const pi = raw.payment_intent
  if (!pi || typeof pi === "string") return null
  return (pi as { client_secret?: string | null }).client_secret ?? null
}
