import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession } from "@eleva/auth"
import { createIdentityVerificationSession } from "@eleva/billing/server"
import { db, main } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"

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
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request, "POST, OPTIONS")

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
    console.error(
      "[stripe/identity] Verification session creation failed:",
      err
    )
    return NextResponse.json(
      { error: "stripe-error" },
      { status: 502, headers: cors }
    )
  }
}
