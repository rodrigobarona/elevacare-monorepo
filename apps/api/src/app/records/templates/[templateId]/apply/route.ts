import { z } from "zod"
import {
  ApplyRecordTemplateRequestSchema,
  ApplyRecordTemplateResponseSchema,
} from "@eleva/api-client"
import { applyRecordTemplate } from "@eleva/records"
import { withPhiScope } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import {
  requireTemplateCaller,
  templateErrorResponse,
} from "@/lib/record-templates-http"
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

const TemplateIdSchema = z.string().uuid()

type Context = { params: Promise<{ templateId: string }> }

async function handlePOST(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const { templateId } = await context.params
  const id = TemplateIdSchema.safeParse(templateId)
  if (!id.success) {
    return secureJson(
      { error: "invalid_body", issues: id.error.issues },
      { status: 422, headers }
    )
  }
  const caller = await requireTemplateCaller(request, headers)
  if (caller instanceof Response) return caller

  const parsed = ApplyRecordTemplateRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const filled = await applyRecordTemplate({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      id: id.data,
      bookingId: parsed.data.bookingId,
    })
    return secureJson(ApplyRecordTemplateResponseSchema.parse(filled), {
      headers,
    })
  } catch (err) {
    return templateErrorResponse(err, headers, "apply")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}

/** The filled body carries the member's first name and session date. */
export function POST(...args: Parameters<typeof handlePOST>) {
  return withPhiScope(() => handlePOST(...args))
}
