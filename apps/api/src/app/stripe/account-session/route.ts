import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession } from "@eleva/auth"
import { createAccountSession } from "@eleva/billing/server"
import type { ConnectComponentName } from "@eleva/billing/server"
import { db, main } from "@eleva/db"
import { env } from "@eleva/config/env"

/**
 * POST /stripe/account-session
 *
 * Mints a short-lived Stripe Connect AccountSession for an
 * authenticated expert and returns the client_secret that the
 * embedded components on apps/app pages mount with.
 *
 * Cross-origin posture (api.eleva.care):
 *   - Session cookie is set on `.eleva.care` (apex) so it is sent
 *     here from `eleva.care` and `eleva.care/expert/...`.
 *   - The browser MUST call this with `credentials: 'include'`.
 *   - CORS allows the gateway origin only; preview origins on
 *     *.preview.eleva.care are matched dynamically.
 *   - Method allow-list is locked to OPTIONS + POST.
 *
 * RBAC: caller must hold `payouts:view_own` (which the expert role
 * bundle grants). Components are validated against a per-page
 * allow-list to keep AccountSession permissions tight.
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

interface RequestBody {
  components?: string[]
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}

export async function POST(request: Request) {
  const cors = corsHeaders(request)

  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", code: "no-session" },
      { status: 401, headers: cors }
    )
  }
  if (!session.capabilities.includes("payouts:view_own")) {
    return NextResponse.json(
      { error: "forbidden", code: "missing-capability" },
      { status: 403, headers: cors }
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json(
      { error: "invalid-json" },
      { status: 400, headers: cors }
    )
  }

  const components = (body.components ?? []).filter(
    (c): c is ConnectComponentName =>
      typeof c === "string" && ALLOWED_COMPONENTS.has(c as ConnectComponentName)
  )
  if (components.length === 0) {
    return NextResponse.json(
      { error: "components-required" },
      { status: 400, headers: cors }
    )
  }

  // Resolve the connected account from the expert profile owned by
  // this user inside their current org context.
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
    return NextResponse.json(
      { error: "no-expert-profile" },
      { status: 404, headers: cors }
    )
  }
  if (!expert.stripeAccountId) {
    return NextResponse.json(
      { error: "stripe-not-connected" },
      { status: 409, headers: cors }
    )
  }

  try {
    const result = await createAccountSession({
      stripeAccountId: expert.stripeAccountId,
      components,
    })
    return NextResponse.json(
      {
        clientSecret: result.clientSecret,
        expiresAt: result.expiresAt,
      },
      { headers: cors }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "stripe-error", message },
      { status: 502, headers: cors }
    )
  }
}

/**
 * Build CORS headers tied to the request's Origin. The `credentials:
 * 'include'` flow forbids `Access-Control-Allow-Origin: *`; we must
 * echo back the exact origin if and only if it's allow-listed.
 *
 * Allow-list:
 *   - APP_URL (production: https://eleva.care)
 *   - any *.preview.eleva.care subdomain
 *   - localhost in development
 */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? ""
  const allowOrigin = matchAllowedOrigin(origin)

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-correlation-id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin
  }
  return headers
}

function matchAllowedOrigin(origin: string): string | null {
  if (!origin) return null

  const e = env()
  const explicit = (e.APP_URL ?? "").replace(/\/$/, "")
  if (explicit && origin === explicit) return origin

  const url = safeUrl(origin)
  if (!url) return null

  if (
    e.NODE_ENV === "development" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return origin
  }

  if (url.hostname.endsWith(".preview.eleva.care")) {
    return origin
  }

  return null
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}
