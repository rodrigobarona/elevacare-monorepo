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
  lockEventTypeForUpdate,
  main,
  updateEventType,
} from "@eleva/db"
import { publishEventType, type PublishViolation } from "@eleva/scheduling"
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

class EventTypeNotFoundError extends Error {
  constructor() {
    super("event type not found")
    this.name = "EventTypeNotFoundError"
  }
}

class OfferInvariantPublishError extends Error {
  violations: PublishViolation[]
  constructor(violations: PublishViolation[]) {
    super("Event type cannot be published until offer invariants pass")
    this.name = "OfferInvariantPublishError"
    this.violations = violations
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

  const identityRequired = await getFlag("ff.expert_identity_verification")

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const locked = await lockEventTypeForUpdate(
          profile.orgId,
          id,
          profile.id,
          tx
        )
        if (!locked) {
          throw new EventTypeNotFoundError()
        }

        const modes = await listEventTypeModesWithLocation(
          profile.orgId,
          id,
          tx
        )
        const gate = publishEventType({
          kind: locked.kind,
          hasPublicHandle: Boolean(
            profile.username && profile.username.length >= 3
          ),
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
          throw new OfferInvariantPublishError(gate.violations)
        }

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
    if (err instanceof EventTypeNotFoundError) {
      return secureJson(
        { error: "not found", message: "event type not found" },
        { status: 404, headers }
      )
    }
    if (err instanceof OfferInvariantPublishError) {
      return secureJson(
        {
          error: "OFFER_INVARIANT_VIOLATION",
          code: "OFFER_INVARIANT_VIOLATION",
          message: err.message,
          violations: err.violations,
        },
        { status: 422, headers }
      )
    }
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
    console.error("[event-types] publish failed", err)
    return secureJson(
      { error: "internal", message: "Internal server error" },
      { status: 500, headers }
    )
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
