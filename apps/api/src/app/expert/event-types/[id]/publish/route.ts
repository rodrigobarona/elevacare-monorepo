import { eq } from "drizzle-orm"
import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import {
  enqueueSeatSync,
  isConnectPublishReady,
  markSeatSyncPending,
} from "@eleva/billing/server"
import { getFlag } from "@eleva/flags"
import { getExpertProfileByUserId, main, updateEventType } from "@eleva/db"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PublishSchema = z.object({
  published: z.boolean(),
})

class ConnectIncompleteError extends Error {
  constructor() {
    super("Complete Payments onboarding before publishing an event type")
    this.name = "ConnectIncompleteError"
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "PATCH, OPTIONS")

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

  const body = PublishSchema.safeParse(await request.json().catch(() => ({})))
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

  const { id } = await params
  const identityRequired = body.data.published
    ? await getFlag("ff.expert_identity_verification")
    : false

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        if (body.data.published) {
          const [connect] = await tx
            .select({
              detailsSubmitted: main.billingCustomers.detailsSubmitted,
              payoutsEnabled: main.billingCustomers.payoutsEnabled,
              connectCapabilities: main.billingCustomers.connectCapabilities,
              identityStatus: main.billingCustomers.identityStatus,
            })
            .from(main.billingCustomers)
            .where(eq(main.billingCustomers.orgId, profile.orgId))
            .limit(1)
            .for("update")
          const ready = isConnectPublishReady({
            detailsSubmitted: connect?.detailsSubmitted ?? false,
            payoutsEnabled: connect?.payoutsEnabled ?? false,
            transfersStatus: connect?.connectCapabilities?.transfers,
            identityRequired,
            identityStatus:
              connect?.identityStatus ?? profile.stripeIdentityStatus ?? null,
          })
          if (!ready) throw new ConnectIncompleteError()
        }
        await updateEventType(
          profile.orgId,
          id,
          { published: body.data.published },
          profile.id,
          tx
        )
        await ctx.emit({
          entity: "event_type",
          action: body.data.published ? "published" : "unpublished",
          entityId: id,
          payload: { published: body.data.published },
        })
        await markSeatSyncPending(profile.orgId, tx)
      }
    )
  } catch (err) {
    if (err instanceof ConnectIncompleteError) {
      return secureJson(
        {
          error: "CONNECT_INCOMPLETE",
          code: "CONNECT_INCOMPLETE",
          message: err.message,
        },
        { status: 409, headers }
      )
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson({ error: "internal", message }, { status: 500, headers })
  }

  try {
    await enqueueSeatSync(profile.orgId, session.user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : "seat sync failed"
    console.error("[event-types] seat sync pending", message)
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PATCH, OPTIONS"),
  })
}
