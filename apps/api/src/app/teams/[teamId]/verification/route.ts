import { FileClinicVerificationRequestSchema } from "@eleva/api-client"
import { fileClinicVerification } from "@eleva/auth"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import {
  requireTeamCaller,
  teamErrorResponse,
  teamResponse,
} from "@/lib/teams-http"

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
 * POST /teams/{teamId}/verification — file (or refile) the clinic's legal
 * name and NIF for Eleva staff to check. Audited as
 * clinic_verification.submitted.
 */
export async function POST(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTeamCaller(
    request,
    headers,
    (await context.params).teamId,
    { mutation: true }
  )
  if (caller instanceof Response) return caller
  const parsed = FileClinicVerificationRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }
  try {
    const summary = await fileClinicVerification({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      ...parsed.data,
    })
    return teamResponse(summary, headers, 201)
  } catch (err) {
    return teamErrorResponse(err, headers, "file verification")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
