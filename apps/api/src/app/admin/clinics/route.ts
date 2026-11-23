import { AdminClinicQueueResponseSchema } from "@eleva/api-client"
import { listClinicVerificationQueue } from "@eleva/auth/clinic-review"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import {
  requestedQueuePage,
  requireStaffReviewer,
} from "@/lib/staff-review-http"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /admin/clinics?page= — one page of the staff queue of clinic identity
 * filings. Each read is recorded with the reader.
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const staff = await requireStaffReviewer(request, headers)
  if (staff instanceof Response) return staff

  const page = requestedQueuePage(request, headers)
  if (page instanceof Response) return page

  const queue = await listClinicVerificationQueue({
    page,
    viewer: { actorUserId: staff.userId, orgId: staff.orgId, via: staff.via },
  })
  return secureJson(
    AdminClinicQueueResponseSchema.parse({
      ...queue,
      items: queue.items.map((row) => ({
        ...row,
        waitingSince: row.waitingSince.toISOString(),
      })),
    }),
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
