import { cancelCancelablePaymentIntents } from "@eleva/billing/server"
import {
  completeSweptAccountDeletions,
  sweepAccountDeletions,
} from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { authorizeWorkflowSecret } from "@/lib/qstash-publish"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  if (!process.env.WORKFLOWS_DRAIN_SECRET) {
    return secureJson(
      {
        error: "server_misconfiguration",
        message: "WORKFLOWS_DRAIN_SECRET is required",
      },
      { status: 500, headers }
    )
  }
  if (!authorizeWorkflowSecret(request)) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  try {
    const result = await sweepAccountDeletions()
    const outcomes = await cancelCancelablePaymentIntents(
      result.paymentIntentIds
    )
    const paymentIntentFailures = outcomes
      .filter((outcome) => outcome.status === "failed")
      .map((outcome) => outcome.id)
    if (paymentIntentFailures.length > 0) {
      return secureJson(
        {
          ok: false,
          error: "payment_intent_cancel_failed",
          raced: result.raced,
          completed: result.completed,
          paymentIntentFailures,
        },
        { status: 500, headers }
      )
    }
    const completedAfterCancel = await completeSweptAccountDeletions(
      result.awaitingCompletion
    )
    return secureJson(
      {
        ok: true,
        raced: result.raced,
        completed: result.completed + completedAfterCancel,
        paymentIntentFailures: [],
      },
      { status: 200, headers }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
