import {
  AdminPartnerQueueResponseSchema,
  StaffQueueQuerySchema,
} from "@eleva/api-client"
import { listLicenceQueue } from "@eleva/auth/partner-review"
import { corsHeaders } from "@/lib/cors"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { requireStaffReviewer } from "@/lib/staff-review-http"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /admin/partners?page= — one page of the staff licence review queue,
 * oldest first. Each read is recorded with the reader.
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const staff = await requireStaffReviewer(request, headers)
  if (staff instanceof Response) return staff

  const query = StaffQueueQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  const queue = await listLicenceQueue({
    page: query.data.page,
    viewer: { actorUserId: staff.userId, orgId: staff.orgId },
  })
  return secureJson(
    AdminPartnerQueueResponseSchema.parse({
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
