import { z } from "zod"
import {
  RecordTemplateSchema,
  UpdateRecordTemplateRequestSchema,
} from "@eleva/api-client"
import { archiveRecordTemplate, updateRecordTemplate } from "@eleva/records"
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

const METHODS = "PATCH, DELETE, OPTIONS"

const TemplateIdSchema = z.string().uuid()

type Context = { params: Promise<{ templateId: string }> }

async function parseId(context: Context, headers: Record<string, string>) {
  const { templateId } = await context.params
  const parsed = TemplateIdSchema.safeParse(templateId)
  if (parsed.success) return parsed.data
  return secureJson(
    { error: "invalid_body", issues: parsed.error.issues },
    { status: 422, headers }
  )
}

export async function PATCH(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const id = await parseId(context, headers)
  if (id instanceof Response) return id
  const caller = await requireTemplateCaller(request, headers)
  if (caller instanceof Response) return caller

  const parsed = UpdateRecordTemplateRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const template = await updateRecordTemplate({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      id,
      ...parsed.data,
    })
    return secureJson(RecordTemplateSchema.parse(template), { headers })
  } catch (err) {
    return templateErrorResponse(err, headers, "update")
  }
}

export async function DELETE(request: Request, context: Context) {
  const headers = corsHeaders(request, METHODS)
  const id = await parseId(context, headers)
  if (id instanceof Response) return id
  const caller = await requireTemplateCaller(request, headers)
  if (caller instanceof Response) return caller

  try {
    await archiveRecordTemplate({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      id,
    })
    return new Response(null, { status: 204, headers })
  } catch (err) {
    return templateErrorResponse(err, headers, "archive")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}
