import { z } from "zod"
import {
  PayoutActionRequestSchema,
  PayoutActionResponseSchema,
} from "@eleva/api-client"
import { applyHold, isPayoutError } from "@eleva/billing/server"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireStaffPayoutMutator } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

const PayoutIdSchema = z.string().uuid()

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireStaffPayoutMutator(request, "admin_payouts:hold")
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

  const parsed = PayoutActionRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const { id: rawId } = await params
  const id = PayoutIdSchema.safeParse(rawId)
  if (!id.success) {
    return secureJson(
      { error: "validation", issues: id.error.issues },
      { status: 422, headers }
    )
  }
  try {
    const row = await applyHold({
      payoutStateId: id.data,
      reason: "manual",
      actorUserId: session.user.id,
      staffReason: parsed.data.reason,
    })
    return secureJson(
      PayoutActionResponseSchema.parse({
        id: row.id,
        status: row.status,
        holdReasons: row.holdReasons ?? [],
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (isPayoutError(err)) {
      return secureJson(
        { error: err.code, code: err.code, message: err.message },
        { status: err.status, headers }
      )
    }
    throw err
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
