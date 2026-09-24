import { randomBytes } from "node:crypto"
import { z } from "zod"
import { CreateBookingLinkRequestSchema } from "@eleva/api-client"
import { withAudit } from "@eleva/audit"
import {
  createBookingLink,
  getEventType,
  getEventTypeMode,
  getExpertProfileByUserId,
  getSchedule,
  listBookingLinksForEventType,
  toBookingLinkListItem,
} from "@eleva/db"
import { hashBookingLinkToken, normalizeEmail } from "@eleva/scheduling"
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
  const headers = corsHeaders(request, "GET, POST, OPTIONS")

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

  const eventTypeId = new URL(request.url).searchParams.get("eventTypeId")
  if (!eventTypeId || !z.string().uuid().safeParse(eventTypeId).success) {
    return secureJson(
      {
        error: "validation",
        message: "eventTypeId must be a uuid",
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

  const eventType = await getEventType(profile.orgId, eventTypeId, profile.id)
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  const links = await listBookingLinksForEventType(
    profile.orgId,
    eventTypeId,
    profile.id
  )

  return secureJson(
    { links: links.map(toBookingLinkListItem) },
    { status: 200, headers }
  )
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")

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

  const body = CreateBookingLinkRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
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

  const data = body.data
  const eventType = await getEventType(
    profile.orgId,
    data.eventTypeId,
    profile.id
  )
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  if (data.eventTypeModeId) {
    const mode = await getEventTypeMode(
      profile.orgId,
      data.eventTypeModeId,
      data.eventTypeId
    )
    if (!mode || !mode.active) {
      return secureJson(
        {
          error: "validation",
          message: "eventTypeModeId must be an active mode on this event type",
        },
        { status: 422, headers }
      )
    }
  }

  if (data.scheduleId) {
    const schedule = await getSchedule(
      profile.orgId,
      data.scheduleId,
      profile.id
    )
    if (!schedule) {
      return secureJson(
        {
          error: "validation",
          message: "scheduleId must belong to your practice",
        },
        { status: 422, headers }
      )
    }
  }

  const expiresAt = new Date(data.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return secureJson(
      { error: "validation", message: "expiresAt must be in the future" },
      { status: 422, headers }
    )
  }

  const rawToken = randomBytes(24).toString("base64url")
  const tokenHash = hashBookingLinkToken(rawToken)
  const recipientEmail = data.recipientEmail
    ? normalizeEmail(data.recipientEmail)
    : null

  const created = await withAudit(
    { orgId: profile.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      const link = await createBookingLink(
        profile.orgId,
        {
          orgId: profile.orgId,
          eventTypeId: data.eventTypeId,
          eventTypeModeId: data.eventTypeModeId ?? null,
          scheduleId: data.scheduleId ?? null,
          tokenHash,
          recipientEmail,
          priceCents: data.priceCents ?? null,
          note: data.note?.trim() || null,
          expiresAt,
          maxUses: data.maxUses,
          createdBy: session.user.id,
        },
        tx
      )
      await ctx.emit({
        entity: "booking_link",
        action: "created",
        entityId: link.id,
        payload: {
          eventTypeId: link.eventTypeId,
          maxUses: link.maxUses,
          hasPriceOverride: link.priceCents != null,
        },
      })
      return link
    }
  )

  return secureJson(
    {
      id: created.id,
      token: rawToken,
      urlPath: `/book/${rawToken}`,
      link: toBookingLinkListItem(created),
    },
    { status: 201, headers }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, OPTIONS"),
  })
}
