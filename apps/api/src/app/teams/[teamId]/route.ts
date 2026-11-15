import { UpdateTeamProfileRequestSchema } from "@eleva/api-client"
import { getClinicSummary, updateClinicProfile } from "@eleva/auth"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import {
  requireTeamCaller,
  teamErrorResponse,
  teamResponse,
} from "@/lib/teams-http"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "GET, PATCH, OPTIONS"

type Context = { params: Promise<{ teamId: string }> }

/** GET /teams/{teamId} — the clinic's profile and verification state. */
export async function GET(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTeamCaller(
    request,
    headers,
    (await context.params).teamId
  )
  if (caller instanceof Response) return caller
  try {
    return teamResponse(
      await getClinicSummary(caller.orgId, caller.userId),
      headers
    )
  } catch (err) {
    return teamErrorResponse(err, headers, "get")
  }
}

/** PATCH /teams/{teamId} — edit the clinic's public profile. Audited. */
export async function PATCH(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTeamCaller(
    request,
    headers,
    (await context.params).teamId,
    { mutation: true }
  )
  if (caller instanceof Response) return caller
  const parsed = UpdateTeamProfileRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }
  try {
    const summary = await updateClinicProfile({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      patch: parsed.data,
    })
    return teamResponse(summary, headers)
  } catch (err) {
    return teamErrorResponse(err, headers, "update")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
