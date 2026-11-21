import { AdminClinicQueueResponseSchema } from "@eleva/api-client"
import { listClinicVerificationQueue } from "@eleva/auth/clinic-review"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { requireStaffReviewer } from "@/lib/staff-review-http"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET /admin/clinics — staff queue of clinic identity filings. */
export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const staff = await requireStaffReviewer(request, headers)
  if (staff instanceof Response) return staff

  const rows = await listClinicVerificationQueue()
  return secureJson(
    AdminClinicQueueResponseSchema.parse({
      items: rows.map((row) => ({
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
