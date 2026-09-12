import { z } from "zod"
import {
  RefundBookingPaymentRequestSchema,
  RefundBookingPaymentResponseSchema,
} from "@eleva/api-client"
import { isRefundError, refundBookingPayment } from "@eleva/billing/server"
import { corsHeaders } from "@/lib/cors"
import {
  apiAuthFailure,
  requireApiAuth,
  requireStaffPayoutMutator,
} from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

const BookingPaymentIdSchema = z.string().uuid()

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingPaymentId: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
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

  const expertRefund =
    session.productLabel !== "staff" &&
    session.capabilities.includes("billing:refund")
  const staffRefund = session.capabilities.includes("admin_payouts:refund")
  if (!expertRefund && !staffRefund) {
    return secureJson(
      { error: "forbidden", code: "missing-capability" },
      { status: 403, headers }
    )
  }

  let actingOrgId: string | "platform"
  if (session.productLabel === "staff" || (staffRefund && !expertRefund)) {
    try {
      await requireStaffPayoutMutator(request, "admin_payouts:refund")
      actingOrgId = "platform"
    } catch (err) {
      const failure = apiAuthFailure(err, headers)
      if (failure) return failure
      throw err
    }
  } else if (!session.orgId) {
    return secureJson(
      { error: "forbidden", code: "missing-organization" },
      { status: 403, headers }
    )
  } else {
    actingOrgId = session.orgId
  }

  const { bookingPaymentId: rawPaymentId } = await params
  const paymentId = BookingPaymentIdSchema.safeParse(rawPaymentId)
  if (!paymentId.success) {
    return secureJson(
      { error: "validation", issues: paymentId.error.issues },
      { status: 422, headers }
    )
  }
  const parsed = RefundBookingPaymentRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await refundBookingPayment({
      bookingPaymentId: paymentId.data,
      amountCents: parsed.data.amountCents,
      reason: parsed.data.reason,
      actorUserId: session.user.id,
      actingOrgId,
      idempotencyKey:
        request.headers.get("Idempotency-Key")?.trim() ||
        parsed.data.idempotencyKey,
      actorIsStaffReviewer: Boolean(staffRefund),
    })
    return secureJson(RefundBookingPaymentResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (isRefundError(err)) {
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
