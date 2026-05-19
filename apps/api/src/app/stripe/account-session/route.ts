import { eq } from "drizzle-orm"
import { z } from "zod"
import { UnauthorizedError } from "@eleva/auth"
import { createAccountSession } from "@eleva/billing/server"
import type { ConnectComponentName } from "@eleva/billing/server"
import { db, main } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

/**
 * POST /stripe/account-session
 *
 * Mints a short-lived Stripe Connect AccountSession for an
 * authenticated expert and returns the client_secret that the
 * embedded components on the expert app mount with.
 *
 * Auth model (api-first per AGENTS.md): session-based (cookie) OR
 * Bearer token. Caller must hold the `payouts:view_own` capability
 * (granted to the expert role bundle). Components are validated
 * against a per-page allow-list to keep AccountSession permissions
 * tight.
 *
 * Cross-origin posture: the session cookie is set on the apex
 * (`.eleva.care`) so it is sent here from `eleva.care/expert/...`.
 * Browsers must call this with `credentials: "include"`. CORS allows
 * the gateway origin only; preview origins on `*.preview.eleva.care`
 * are matched dynamically via `corsHeaders`.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_COMPONENTS: ReadonlySet<ConnectComponentName> = new Set([
  "account_onboarding",
  "account_management",
  "notification_banner",
  "balances",
  "payouts",
  "payments",
  "tax_settings",
  "tax_registrations",
])

const RequestSchema = z.object({
  components: z.array(z.string()).min(1, "at least one component is required"),
})

/**
 * Response shape used by `satisfies` in the route. The OpenAPI spec
 * for this route lives in apps/api/src/lib/openapi.ts (Zod schemas
 * there generate the JSON spec); we keep this as a TypeScript
 * interface here to avoid an unused runtime Zod schema.
 */
export interface CreateAccountSessionResponse {
  clientSecret: string
  expiresAt: number
}

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

  if (!session.capabilities.includes("payouts:view_own")) {
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

  const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const components = parsed.data.components.filter(
    (c): c is ConnectComponentName =>
      ALLOWED_COMPONENTS.has(c as ConnectComponentName)
  )
  if (components.length === 0) {
    return secureJson({ error: "invalid_components" }, { status: 422, headers })
  }

  const [expert] = await db()
    .select({
      id: main.expertProfiles.id,
      stripeAccountId: main.expertProfiles.stripeAccountId,
      status: main.expertProfiles.status,
    })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.userId, session.user.id))
    .limit(1)

  if (!expert) {
    return secureJson({ error: "no_expert_profile" }, { status: 404, headers })
  }
  if (!expert.stripeAccountId) {
    return secureJson(
      { error: "stripe_not_connected" },
      { status: 409, headers }
    )
  }

  try {
    const result = await createAccountSession({
      stripeAccountId: expert.stripeAccountId,
      components,
    })
    return secureJson(
      {
        clientSecret: result.clientSecret,
        expiresAt: result.expiresAt,
      } satisfies CreateAccountSessionResponse,
      { headers }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      "[stripe/account-session] AccountSession creation failed:",
      message
    )
    return secureJson(
      { error: "stripe_error", message },
      { status: 502, headers }
    )
  }
}
