import { z } from "zod"
import { AdminClinicReviewResponseSchema } from "@eleva/api-client"
import {
  getClinicVerificationReview,
  type ClinicVerificationFiling,
} from "@eleva/auth/clinic-review"
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

function filing(row: ClinicVerificationFiling) {
  return {
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }
}

/** GET /admin/clinics/{verificationId} — one filing, with what staff check. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const staff = await requireStaffReviewer(request, headers)
  if (staff instanceof Response) return staff

  const id = z
    .string()
    .uuid()
    .safeParse((await params).verificationId)
  if (!id.success) {
    return secureJson(
      { error: "validation", issues: id.error.issues },
      { status: 422, headers }
    )
  }
  const review = await getClinicVerificationReview(id.data)
  if (!review) {
    return secureJson(
      { error: "VERIFICATION_NOT_FOUND", code: "VERIFICATION_NOT_FOUND" },
      { status: 404, headers }
    )
  }
  return secureJson(
    AdminClinicReviewResponseSchema.parse({
      ...review,
      verification: filing(review.verification),
      history: review.history.map(filing),
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
