import { detectStuckStripeEvents } from "@eleva/workflows/drainers"
import { corsHeaders } from "@/lib/cors"
import { secureJson } from "@/lib/security-headers"

/**
 * POST /workflows/stripe-stuck-events
 *
 * Stripe webhook stuck-event detector. Scans `stripe_webhook_events`
 * for rows in `received` or `processing` past their threshold and
 * raises a Sentry error per stuck row. Triggered by a QStash schedule
 * (every 5-10 minutes in staging/prod).
 *
 * Authz: Bearer token matching `WORKFLOWS_DRAIN_SECRET` (same posture
 * as `audit-outbox-drainer`). QStash signing keys can replace this
 * once `infra/qstash` wiring is in place.
 *
 * Response shape:
 *   { ok: true, scanned: ISO_TIMESTAMP, stuckCount: number }
 *
 * Recovery: replay any reported event with
 *   pnpm --filter @eleva/infra-stripe replay:event evt_xxx
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  if (!secret) {
    return secureJson(
      {
        error: "server_misconfiguration",
        message: "WORKFLOWS_DRAIN_SECRET is required",
      },
      { status: 500, headers }
    )
  }
  const authHeader = request.headers.get("authorization") ?? ""
  if (authHeader !== `Bearer ${secret}`) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  try {
    const report = await detectStuckStripeEvents({
      heartbeatName: "stripe-stuck-events",
    })
    return secureJson(
      {
        ok: true,
        scanned: report.scanned.toISOString(),
        stuckCount: report.stuck.length,
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
