import { eq } from "drizzle-orm"
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
import {
  getEventType,
  getExpertProfileByUserId,
  listEventTypeModesWithLocation,
  main,
  updateEventType,
} from "@eleva/db"
import { publishEventType } from "@eleva/scheduling"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

class ConnectIncompleteError extends Error {
  constructor() {
    super("Complete Payments onboarding before publishing an event type")
    this.name = "ConnectIncompleteError"
  }
}

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const headers = corsHeaders(request, "POST, OPTIONS")

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

  const { id } = await params
  const eventType = await getEventType(profile.orgId, id, profile.id)
  if (!eventType) {
    return secureJson(
      { error: "not found", message: "event type not found" },
      { status: 404, headers }
    )
  }

  const modes = await listEventTypeModesWithLocation(profile.orgId, id)
  const gate = publishEventType({
    kind: eventType.kind,
    hasPublicHandle: Boolean(profile.username && profile.username.length >= 3),
    worldwideRemote: profile.worldwideRemote,
    serviceCountries: profile.serviceCountries,
    profileLanguages: profile.languages,
    modes: modes.map((mode) => ({
      modeId: mode.id,
      mode: mode.mode,
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      locationCountry: mode.locationCountry,
      active: mode.active,
    })),
  })
  if (!gate.ok) {
    return secureJson(
      {
        error: "OFFER_INVARIANT_VIOLATION",
        code: "OFFER_INVARIANT_VIOLATION",
        message: "Event type cannot be published until offer invariants pass",
        violations: gate.violations,
      },
      { status: 422, headers }
    )
  }

  const identityRequired = await getFlag("ff.expert_identity_verification")

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
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

        await updateEventType(
          profile.orgId,
          id,
          { published: true },
          profile.id,
          tx
        )
        await ctx.emit({
          entity: "event_type",
          action: "published",
          entityId: id,
          payload: { published: true },
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
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
