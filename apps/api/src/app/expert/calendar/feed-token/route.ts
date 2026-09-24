import { randomBytes } from "node:crypto"
import { withAudit } from "@eleva/audit"
import { hashCalendarFeedToken } from "@eleva/calendar/ics-feed"
import {
  getActiveCalendarFeedToken,
  getExpertProfileByUserId,
  rotateCalendarFeedToken,
  revokeCalendarFeedToken,
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

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, POST, DELETE, OPTIONS")

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

  const active = await getActiveCalendarFeedToken(profile.orgId, profile.id)
  return secureJson(
    {
      hasToken: active != null,
      createdAt: active?.createdAt.toISOString() ?? null,
    },
    { status: 200, headers }
  )
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "GET, POST, DELETE, OPTIONS")

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

  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = hashCalendarFeedToken(rawToken)

  const row = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const created = await rotateCalendarFeedToken(
        profile.orgId,
        profile.id,
        tokenHash,
        tx
      )
      await ctx.emit({
        entity: "calendar_feed_token",
        action: "rotated",
        entityId: created.id,
        payload: { expertProfileId: profile.id },
      })
      return created
    }
  )

  return secureJson(
    {
      token: rawToken,
      createdAt: row.createdAt.toISOString(),
    },
    { status: 201, headers }
  )
}

export async function DELETE(request: Request) {
  const headers = corsHeaders(request, "GET, POST, DELETE, OPTIONS")

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

  const active = await getActiveCalendarFeedToken(profile.orgId, profile.id)
  if (!active) {
    return secureJson(
      { error: "not found", message: "no active feed token" },
      { status: 404, headers }
    )
  }

  await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const row = await revokeCalendarFeedToken(profile.orgId, profile.id, tx)
      if (!row) {
        throw new Error("feed token disappeared during revoke")
      }
      await ctx.emit({
        entity: "calendar_feed_token",
        action: "revoked",
        entityId: row.id,
        payload: { expertProfileId: profile.id },
      })
      return row
    }
  )

  return secureJson({ ok: true as const }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, DELETE, OPTIONS"),
  })
}
