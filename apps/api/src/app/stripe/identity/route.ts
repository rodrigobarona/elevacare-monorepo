import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession } from "@eleva/auth"
import { createIdentityVerificationSession } from "@eleva/billing/server"
import { db, main } from "@eleva/db"
import { env } from "@eleva/config/env"

/**
 * POST /stripe/identity
 *
 * Creates a Stripe Identity verification session for the currently
 * authenticated expert. Returns the client_secret that the embedded
 * Identity modal mounts with.
 *
 * RBAC: caller must hold `expert:onboard` capability.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request)

  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", code: "no-session" },
      { status: 401, headers: cors }
    )
  }
  if (!session.capabilities.includes("expert:onboard")) {
    return NextResponse.json(
      { error: "forbidden", code: "missing-capability" },
      { status: 403, headers: cors }
    )
  }

  const [expert] = await db()
    .select({
      id: main.expertProfiles.id,
      orgId: main.expertProfiles.orgId,
      stripeAccountId: main.expertProfiles.stripeAccountId,
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

  try {
    const result = await createIdentityVerificationSession({
      expertProfileId: expert.id,
      orgId: expert.orgId,
      stripeAccountId: expert.stripeAccountId ?? undefined,
    })
    return NextResponse.json(
      {
        id: result.id,
        clientSecret: result.clientSecret,
        status: result.status,
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
