import { DeleteAccountResponseSchema } from "@eleva/api-client"
import { cancelCancelablePaymentIntents } from "@eleva/billing/server"
import {
  AccountDeletionConflictError,
  ACCOUNT_DELETION_GRACE_DAYS,
  scheduleAccountDeletion,
} from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { checkBot } from "@/lib/bot-protection"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
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

  const botVerdict = await checkBot()
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  let scheduled
  try {
    scheduled = await scheduleAccountDeletion({
      userId: session.user.id,
      orgId: session.orgId,
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    })
  } catch (err) {
    if (err instanceof AccountDeletionConflictError) {
      return secureJson({ error: err.code }, { status: 409, headers })
    }
    console.error("[privacy/delete-account] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }

  await cancelCancelablePaymentIntents(scheduled.paymentIntentIds)

  return secureJson(
    DeleteAccountResponseSchema.parse({
      requestId: scheduled.requestId,
      scheduledFor: scheduled.scheduledFor.toISOString(),
    }),
    { status: 201, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
