import { z } from "zod"
import { RemoveTeamMemberResponseSchema } from "@eleva/api-client"
import { removeTeamMember } from "@eleva/auth"
import { enqueueSeatSync, markSeatSyncPending } from "@eleva/billing/server"
import { logError } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import { rejectUnexpectedBody } from "@/lib/empty-body"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { requireTeamCaller, teamErrorResponse } from "@/lib/teams-http"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "DELETE, OPTIONS"

type Context = { params: Promise<{ teamId: string; memberId: string }> }

/**
 * DELETE /teams/{teamId}/members/{memberId} — remove someone from the
 * clinic. Refused for the owner, for the caller, and while the member has
 * sessions still to happen. Audited as membership.removed.
 */
export async function DELETE(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const params = await context.params
  const caller = await requireTeamCaller(request, headers, params.teamId, {
    mutation: true,
    capability: "members:manage",
  })
  if (caller instanceof Response) return caller
  const unexpected = await rejectUnexpectedBody(request, headers)
  if (unexpected) return unexpected
  const memberId = z.string().uuid().safeParse(params.memberId)
  if (!memberId.success) {
    return secureJson(
      { error: "validation", issues: memberId.error.issues },
      { status: 422, headers }
    )
  }
  let removed
  try {
    removed = await removeTeamMember({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      memberId: memberId.data,
      // The seat count changed: keep a durable request to sync Stripe.
      afterRemove: async (tx) => {
        await markSeatSyncPending(caller.orgId, tx)
      },
    })
  } catch (err) {
    return teamErrorResponse(err, headers, "remove member")
  }
  try {
    await enqueueSeatSync(caller.orgId, caller.userId)
  } catch (err) {
    logError("[teams] seat sync pending after removal", err)
  }
  return secureJson(RemoveTeamMemberResponseSchema.parse(removed), {
    status: 200,
    headers,
  })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
