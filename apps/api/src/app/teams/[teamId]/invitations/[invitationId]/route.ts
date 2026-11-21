import { z } from "zod"
import { cancelTeamInvitation } from "@eleva/auth"
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

type Context = { params: Promise<{ teamId: string; invitationId: string }> }

/**
 * DELETE /teams/{teamId}/invitations/{invitationId} — withdraw a pending
 * invitation; its link stops working. Audited as invitation.revoked.
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
  const invitationId = z.string().uuid().safeParse(params.invitationId)
  if (!invitationId.success) {
    return secureJson(
      { error: "validation", issues: invitationId.error.issues },
      { status: 422, headers }
    )
  }
  try {
    await cancelTeamInvitation({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      invitationId: invitationId.data,
    })
    return new Response(null, { status: 204, headers })
  } catch (err) {
    return teamErrorResponse(err, headers, "cancel invitation")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
