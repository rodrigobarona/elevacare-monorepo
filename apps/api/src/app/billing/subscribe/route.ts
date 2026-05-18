import { z, type ZodIssue } from "zod"
import { getSession } from "@eleva/auth"
import {
  createOrgSubscription,
  swapSubscriptionTier,
  stripe,
} from "@eleva/billing/server"
import { secureJson } from "../../../lib/security-headers"
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
 * Auth model: session-based (cookie). The user must hold
 * `billing:manage_org` or `subscriptions:manage_org` capability.
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

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return secureJson(
      { error: "unauthorized", code: "no-session" },
      { status: 401 }
    )
  }

  const canManageBilling =
    session.capabilities.includes("billing:manage_org") ||
    session.capabilities.includes("subscriptions:manage_org")

  if (!canManageBilling) {
    return secureJson(
      { error: "forbidden", code: "missing-capability" },
      { status: 403 }
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
    const message =
      err instanceof z.ZodError
        ? err.issues
            .map((e: ZodIssue) => `${e.path.join(".")}: ${e.message}`)
            .join(", ")
        : "invalid-json"
    return secureJson({ error: "validation_error", message }, { status: 400 })
  }

  const { tier, quantity } = body

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
      { status: 409 }
    )
  }

  const subscriptions = await s.subscriptions.list({
    customer: customer.id,
    status: "active",
    limit: 5,
  })

  const existingSub = subscriptions.data[0]

  try {
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
          { status: 404 }
        )
      }

      const clientSecret = await extractClientSecret(s, updated.latest_invoice)

      return secureJson({
        subscriptionId: updated.id,
        status: updated.status,
        clientSecret,
      })
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
        { status: 404 }
      )
    }

    const clientSecret = await extractClientSecret(
      s,
      subscription.latest_invoice
    )

    return secureJson({
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson({ error: "stripe_error", message }, { status: 502 })
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
