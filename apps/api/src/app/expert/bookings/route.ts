import { z } from "zod"
import { getExpertProfileByUserId, listExpertBookings } from "@eleva/db"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const QuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000 // ~2 months

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "events:manage")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  })
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  const from = new Date(parsed.data.from)
  const to = new Date(parsed.data.to)
  if (!(from < to) || to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return secureJson(
      {
        error: "validation",
        message: "from must be before to and the range must be at most 62 days",
      },
      { status: 422, headers }
    )
  }

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const rows = await listExpertBookings(profile.orgId, profile.id, from, to)

  return secureJson(
    {
      bookings: rows.map((b) => ({
        id: b.id,
        status: b.status,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        timezone: b.timezone,
        sessionMode: b.sessionMode,
        memberFirstName: b.memberFirstName,
        eventTypeTitle: b.eventTypeTitle,
        eventTypeSlug: b.eventTypeSlug,
        modeLabel: b.modeLabel,
        locationName: b.locationName,
        locationCity: b.locationCity,
        locationCountry: b.locationCountry,
        locationAddress: b.locationAddress,
      })),
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
