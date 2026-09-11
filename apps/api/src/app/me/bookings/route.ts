import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { ListMeBookingsQuerySchema } from "@eleva/api-client"
import { listMemberBookings } from "@eleva/db"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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
  const query = ListMeBookingsQuerySchema.safeParse({
    range: url.searchParams.get("range") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  })
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  const result = await listMemberBookings({
    userId: session.user.id,
    range: query.data.range,
    cursor: query.data.cursor,
  })

  return secureJson(
    {
      bookings: result.items.map((booking) => ({
        id: booking.id,
        orgId: booking.orgId,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        timezone: booking.timezone,
        sessionMode: booking.sessionMode,
        priceCents: booking.priceCents,
        currency: "EUR" as const,
        expert: booking.expert,
        eventType: booking.eventType,
      })),
      nextCursor: result.nextCursor,
    },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
