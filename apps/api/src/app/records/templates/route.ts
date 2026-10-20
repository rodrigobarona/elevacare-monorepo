import { z } from "zod"
import {
  CreateRecordTemplateRequestSchema,
  ListRecordTemplatesResponseSchema,
  RecordTemplateKindSchema,
  RecordTemplateSchema,
} from "@eleva/api-client"
import {
  createRecordTemplate,
  listRecordTemplates,
  STARTER_RECORD_TEMPLATES,
} from "@eleva/records"
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

const METHODS = "GET, POST, OPTIONS"

const ListQuerySchema = z.object({
  kind: RecordTemplateKindSchema.optional(),
})

const STARTERS = STARTER_RECORD_TEMPLATES.flatMap((template) =>
  (["en", "pt", "es"] as const).map((locale) => ({
    key: template.key,
    kind: template.kind,
    specialty: template.specialty,
    locale,
    title: template.copy[locale].title,
    body: template.copy[locale].body,
  }))
)

export async function GET(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTemplateCaller(request, headers)
  if (caller instanceof Response) return caller

  const query = ListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  if (!query.success) {
    return secureJson(
      { error: "invalid_query", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const templates = await listRecordTemplates({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      kind: query.data.kind,
    })
    const starters = query.data.kind
      ? STARTERS.filter((s) => s.kind === query.data.kind)
      : STARTERS
    return secureJson(
      ListRecordTemplatesResponseSchema.parse({ templates, starters }),
      { headers }
    )
  } catch (err) {
    return templateErrorResponse(err, headers, "list")
  }
}

async function handlePOST(request: Request) {
  const headers = corsHeaders(request, METHODS)
  const caller = await requireTemplateCaller(request, headers)
  if (caller instanceof Response) return caller

  const parsed = CreateRecordTemplateRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const template = await createRecordTemplate({
      orgId: caller.orgId,
      actorUserId: caller.userId,
      ...parsed.data,
    })
    return secureJson(RecordTemplateSchema.parse(template), {
      status: 201,
      headers,
    })
  } catch (err) {
    return templateErrorResponse(err, headers, "create")
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, METHODS),
  })
}

/** "Save as template" decrypts the source booking's records for the scrubber. */
export function POST(request: Request) {
  return withPhiScope(() => handlePOST(request))
}
