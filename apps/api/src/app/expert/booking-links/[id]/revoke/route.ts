import { z } from "zod"
import { withAudit } from "@eleva/audit"
import {
  getBookingLinkForExpert,
  getExpertProfileByUserId,
  revokeBookingLink,
  toBookingLinkListItem,
} from "@eleva/db"
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

type Params = { params: Promise<{ id: string }> }

const IdSchema = z.string().uuid()

export async function POST(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const { id } = await params

  if (!IdSchema.safeParse(id).success) {
    return secureJson(
      { error: "validation", message: "id must be a uuid" },
      { status: 422, headers }
    )
  }

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

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const existing = await getBookingLinkForExpert(profile.orgId, id, profile.id)
  if (!existing) {
    return secureJson(
      { error: "not found", message: "booking link not found" },
      { status: 404, headers }
    )
  }
  if (existing.revokedAt != null) {
    return secureJson(
      { ok: true as const, link: toBookingLinkListItem(existing) },
      { status: 200, headers }
    )
  }

  const revoked = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const result = await revokeBookingLink(profile.orgId, id, profile.id, tx)
      if (!result) return null
      await ctx.emit({
        entity: "booking_link",
        action: "canceled",
        entityId: result.link.id,
        payload: { eventTypeId: result.link.eventTypeId },
      })
      return result.link
    }
  )

  if (!revoked) {
    return secureJson(
      { error: "not found", message: "booking link not found" },
      { status: 404, headers }
    )
  }

  return secureJson(
    { ok: true as const, link: toBookingLinkListItem(revoked) },
    { status: 200, headers }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
