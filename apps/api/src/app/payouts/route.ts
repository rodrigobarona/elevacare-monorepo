import {
  ListPayoutsQuerySchema,
  ListPayoutsResponseSchema,
} from "@eleva/api-client"
import {
  isPayoutError,
  listPayouts,
  type PayoutStatus,
} from "@eleva/billing/server"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function holdReasons(values: string[] | null): Array<"dispute" | "manual"> {
  return (values ?? []).filter(
    (value): value is "dispute" | "manual" =>
      value === "dispute" || value === "manual"
  )
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

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
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const url = new URL(request.url)
  const query = ListPayoutsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    orgId: url.searchParams.get("orgId") ?? undefined,
  })
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  const staffRead = session.capabilities.includes("admin_payouts:read")
  const expertRead = session.capabilities.includes("payouts:view_own")
  if (!staffRead && !expertRead) {
    return secureJson(
      { error: "forbidden", code: "missing-capability" },
      { status: 403, headers }
    )
  }

  if (!staffRead) {
    if (query.data.orgId && query.data.orgId !== session.orgId) {
      return secureJson(
        { error: "forbidden", code: "ORG_MISMATCH" },
        { status: 403, headers }
      )
    }
  }

  try {
    const rows = await listPayouts({
      orgId: staffRead ? query.data.orgId : session.orgId,
      status: query.data.status as PayoutStatus | undefined,
      platformAdmin: staffRead,
    })
    return secureJson(
      ListPayoutsResponseSchema.parse({
        payouts: rows.map((row) => ({
          id: row.id,
          orgId: row.orgId,
          bookingPaymentId: row.bookingPaymentId,
          status: row.status,
          amountCents: row.amountCents,
          reversedCents: row.reversedCents,
          eligibleAt: row.eligibleAt.toISOString(),
          holdReasons: holdReasons(row.holdReasons),
          stripeTransferId: row.stripeTransferId,
        })),
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (isPayoutError(err)) {
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
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
