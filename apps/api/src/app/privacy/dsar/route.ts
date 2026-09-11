import { after } from "next/server"
import { CreateDsarRequestResponseSchema } from "@eleva/api-client"
import { createDsarRequest, processDsarExport } from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { publishWorkflowJob } from "@/lib/qstash-publish"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  const created = await createDsarRequest({
    userId: session.user.id,
    orgId: session.orgId,
  })

  after(() =>
    kickoffDsarExport({
      dsarId: created.id,
      userId: session.user.id,
      orgId: session.orgId,
    }).catch((err) => {
      console.error("[privacy/dsar] export kickoff failed", err)
    })
  )

  return secureJson(
    CreateDsarRequestResponseSchema.parse({
      id: created.id,
      status: "pending",
    }),
    { status: created.reused ? 200 : 201, headers }
  )
}

async function kickoffDsarExport(input: {
  dsarId: string
  userId: string
  orgId: string
}): Promise<void> {
  const published = await publishWorkflowJob("/workflows/dsar-export", input)
  if (published === "inline") {
    await processDsarExport(input)
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
