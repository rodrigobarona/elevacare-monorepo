import { z } from "zod"
import {
  CrmContactSchema,
  UpdateCrmContactRequestSchema,
} from "@eleva/api-client"
import { updateCrmContact } from "@eleva/crm"
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

const METHODS = "PATCH, OPTIONS"

type Context = { params: Promise<{ contactId: string }> }

async function handlePATCH(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const id = z
    .string()
    .uuid()
    .safeParse((await context.params).contactId)
  if (!id.success) return invalid("invalid_body", id.error.issues, headers)
  const caller = await requireCrmCaller(request, headers)
  if (caller instanceof Response) return caller

  const parsed = UpdateCrmContactRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return invalid("invalid_body", parsed.error.issues, headers)

  try {
    const contact = await updateCrmContact({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      contactId: id.data,
      ...parsed.data,
    })
    return secureJson(CrmContactSchema.parse(contact), { headers })
  } catch (err) {
    return crmErrorResponse(err, headers, "update contact")
  }
}

export function PATCH(request: Request, context: Context) {
  return withPhiScope(() => handlePATCH(request, context))
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
