import { TeamMembersResponseSchema } from "@eleva/api-client"
import { listTeamMembers } from "@eleva/auth"
import { getClinicSeatAllowance } from "@eleva/billing/server"
import { corsHeaders } from "@/lib/cors"
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

const METHODS = "GET, OPTIONS"

type Context = { params: Promise<{ teamId: string }> }

/**
 * GET /teams/{teamId}/members — the clinic's people: members, pending
 * invitations and how many seats are billable.
 */
export async function GET(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTeamCaller(
    request,
    headers,
    (await context.params).teamId,
    { capability: "members:manage" }
  )
  if (caller instanceof Response) return caller
  try {
    const [roster, allowance] = await Promise.all([
      listTeamMembers(caller.orgId),
      getClinicSeatAllowance(caller.orgId),
    ])
    return secureJson(
      TeamMembersResponseSchema.parse({
        members: roster.members.map((member) => ({
          ...member,
          joinedAt: member.joinedAt.toISOString(),
        })),
        invitations: roster.invitations.map((invitation) => ({
          ...invitation,
          invitedAt: invitation.invitedAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
        })),
        seats: { billable: roster.billableSeats, ...allowance },
      }),
      { status: 200, headers }
    )
  } catch (err) {
    return teamErrorResponse(err, headers, "list members")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
