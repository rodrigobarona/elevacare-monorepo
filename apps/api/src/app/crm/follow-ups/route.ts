import {
  CreateCrmFollowUpRequestSchema,
  CrmFollowUpSchema,
  ListCrmFollowUpsQuerySchema,
  ListCrmFollowUpsResponseSchema,
} from "@eleva/api-client"
import { createCrmFollowUp, listCrmFollowUps } from "@eleva/crm"
import { withPhiScope } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import { crmErrorResponse, invalid, requireCrmCaller } from "@/lib/crm-http"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "GET, POST, OPTIONS"

async function handleGET(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireCrmCaller(request, headers)
  if (caller instanceof Response) return caller

  const query = ListCrmFollowUpsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  if (!query.success)
    return invalid("invalid_query", query.error.issues, headers)

  try {
    const followUps = await listCrmFollowUps({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      ...query.data,
    })
    return secureJson(ListCrmFollowUpsResponseSchema.parse({ followUps }), {
      headers,
    })
  } catch (err) {
    return crmErrorResponse(err, headers, "list follow-ups")
  }
}

async function handlePOST(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireCrmCaller(request, headers)
  if (caller instanceof Response) return caller

  const parsed = CreateCrmFollowUpRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return invalid("invalid_body", parsed.error.issues, headers)

  try {
    const followUp = await createCrmFollowUp({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      ...parsed.data,
      dueAt: new Date(parsed.data.dueAt),
    })
    return secureJson(CrmFollowUpSchema.parse(followUp), {
      status: 201,
      headers,
    })
  } catch (err) {
    return crmErrorResponse(err, headers, "create follow-up")
  }
}

export function GET(request: Request) {
  return withPhiScope(() => handleGET(request))
}

export function POST(request: Request) {
  return withPhiScope(() => handlePOST(request))
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
