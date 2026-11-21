import { z } from "zod"
import {
  ClinicDecisionRequestSchema,
  ClinicDecisionResponseSchema,
} from "@eleva/api-client"
import {
  ClinicReviewError,
  decideClinicVerification,
} from "@eleva/auth/clinic-review"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { requireStaffReviewer } from "@/lib/staff-review-http"

// No BotID: an authenticated staff route (AGENTS.md: BotID is for public,
// unauthenticated POSTs).
export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /admin/clinics/{verificationId}/decision — approve, ask for changes
 * or reject a pending filing. Audited as clinic_verification.approved,
 * .changes_requested or .rejected.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const staff = await requireStaffReviewer(request, headers, {
    decision: true,
  })
  if (staff instanceof Response) return staff

  const id = z
    .string()
    .uuid()
    .safeParse((await params).verificationId)
  const body = ClinicDecisionRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!id.success || !body.success) {
    return secureJson(
      {
        error: "validation",
        issues: [...(id.error?.issues ?? []), ...(body.error?.issues ?? [])],
      },
      { status: 422, headers }
    )
  }

  const { submittedAt, ...decision } = body.data
  try {
    const result = await decideClinicVerification({
      verificationId: id.data,
      submittedAt: new Date(submittedAt),
      actorUserId: staff.userId,
      decision,
    })
    return secureJson(ClinicDecisionResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (err instanceof ClinicReviewError) {
      return secureJson(
        { error: err.code, code: err.code },
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
