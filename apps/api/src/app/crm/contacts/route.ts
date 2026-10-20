import {
  CreateCrmContactRequestSchema,
  CrmContactSchema,
  ListCrmContactsQuerySchema,
  ListCrmContactsResponseSchema,
} from "@eleva/api-client"
import { createCrmContact, listCrmContacts } from "@eleva/crm"
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

  const query = ListCrmContactsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  if (!query.success)
    return invalid("invalid_query", query.error.issues, headers)

  try {
    const contacts = await listCrmContacts({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      stage: query.data.stage,
    })
    return secureJson(ListCrmContactsResponseSchema.parse({ contacts }), {
      headers,
    })
  } catch (err) {
    return crmErrorResponse(err, headers, "list contacts")
  }
}

async function handlePOST(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireCrmCaller(request, headers)
  if (caller instanceof Response) return caller

  const parsed = CreateCrmContactRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return invalid("invalid_body", parsed.error.issues, headers)

  try {
    const contact = await createCrmContact({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      ...parsed.data,
    })
    return secureJson(CrmContactSchema.parse(contact), {
      status: 201,
      headers,
    })
  } catch (err) {
    return crmErrorResponse(err, headers, "create contact")
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
