import {
  InviteTeamMemberRequestSchema,
  InviteTeamMemberResponseSchema,
} from "@eleva/api-client"
import { inviteTeamMember } from "@eleva/auth"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { requireTeamCaller, teamErrorResponse } from "@/lib/teams-http"

// No BotID: an authenticated clinic-admin route that agents call with a
// bearer key (AGENTS.md: BotID is for public, unauthenticated POSTs).
export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "POST, OPTIONS"

type Context = { params: Promise<{ teamId: string }> }

/**
 * POST /teams/{teamId}/invitations — invite someone to the clinic by email
 * (valid 7 days), or renew the pending invitation for that address.
 * Audited as invitation.invited.
 */
export async function POST(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTeamCaller(
    request,
    headers,
    (await context.params).teamId,
    { mutation: true, capability: "members:manage" }
  )
  if (caller instanceof Response) return caller
  const parsed = InviteTeamMemberRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }
  try {
    const result = await inviteTeamMember({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      email: parsed.data.email,
      role: parsed.data.role,
    })
    return secureJson(
      InviteTeamMemberResponseSchema.parse({
        invitation: {
          id: result.invitationId,
          email: result.email,
          role: result.role,
          expiresAt: result.expiresAt.toISOString(),
        },
        resent: result.resent,
        emailSent: result.emailSent,
      }),
      { status: result.resent ? 200 : 201, headers }
    )
  } catch (err) {
    return teamErrorResponse(err, headers, "invite member")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
