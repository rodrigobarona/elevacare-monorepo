import { BookingReminderRequestSchema } from "@eleva/api-client"
import { deliverBookingReminder } from "@eleva/workflows/notifications"
import { corsHeaders } from "@/lib/cors"
import {
  authorizeInternalWorkflow,
  internalWorkflowOptions,
} from "@/lib/internal-workflow"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /workflows/booking-reminder
 *
 * QStash delayed handler for T-24h / T-1h booking reminders. Re-checks
 * that the booking is still confirmed or rescheduled and that startsAt
 * still matches before sendNotification. Cancel does not delete the
 * QStash message.
 *
 * Authz: Bearer `WORKFLOWS_DRAIN_SECRET`.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const denied = authorizeInternalWorkflow(request)
  if (denied) return denied
  const headers = corsHeaders(request, "POST, OPTIONS")
  const parsed = BookingReminderRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await deliverBookingReminder(parsed.data)
    return secureJson({ ...result, ok: true }, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }
}

export function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
