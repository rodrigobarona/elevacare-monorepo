import { z } from "zod"
import { CrmFollowUpSchema } from "@eleva/api-client"
import { completeCrmFollowUp } from "@eleva/crm"
import { withPhiScope } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import { crmErrorResponse, invalid, requireCrmCaller } from "@/lib/crm-http"
import { rejectUnexpectedBody } from "@/lib/empty-body"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const METHODS = "POST, OPTIONS"

type Context = { params: Promise<{ followUpId: string }> }

async function handlePOST(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const id = z
    .string()
    .uuid()
    .safeParse((await context.params).followUpId)
  if (!id.success) return invalid("invalid_body", id.error.issues, headers)
  const caller = await requireCrmCaller(request, headers)
  if (caller instanceof Response) return caller

  const unexpectedBody = await rejectUnexpectedBody(request, headers)
  if (unexpectedBody) return unexpectedBody

  try {
    const followUp = await completeCrmFollowUp({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      followUpId: id.data,
    })
    return secureJson(CrmFollowUpSchema.parse(followUp), { headers })
  } catch (err) {
    return crmErrorResponse(err, headers, "complete follow-up")
  }
}

export function POST(request: Request, context: Context) {
  return withPhiScope(() => handlePOST(request, context))
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
