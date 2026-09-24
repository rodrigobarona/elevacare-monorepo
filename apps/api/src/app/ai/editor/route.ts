import {
  EditorAssistRequestSchema,
  type EditorAssistRequest,
} from "@eleva/api-client"
import {
  AiClinicalContextRejectedError,
  AiModelEnvMissingError,
  AiModelNotApprovedError,
  AiTranslateLocaleRequiredError,
  editorAssist,
  resolveEditorModelId,
} from "@eleva/ai"
import {
  getEventType,
  getExpertProfileByUserId,
  getPracticeLocation,
} from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function assertResourceOwned(input: {
  orgId: string
  expertProfileId: string
  resource: EditorAssistRequest["resource"]
  resourceId: string
}): Promise<boolean> {
  switch (input.resource) {
    case "expert_profile":
      return input.resourceId === input.expertProfileId
    case "event_type": {
      const row = await getEventType(
        input.orgId,
        input.resourceId,
        input.expertProfileId
      )
      return Boolean(row)
    }
    case "location": {
      const row = await getPracticeLocation(
        input.orgId,
        input.resourceId,
        input.expertProfileId
      )
      return Boolean(row)
    }
    default: {
      const _exhaustive: never = input.resource
      return _exhaustive
    }
  }
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const startedAt = Date.now()

  let session
  try {
    session = await requireApiCapability(request, "expert:profile_edit")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const body = EditorAssistRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const rateLimited = await applyRateLimit(
    `org:${profile.orgId}`,
    RATE_LIMITS.editorAi,
    headers
  )
  if (rateLimited) return rateLimited

  const owned = await assertResourceOwned({
    orgId: profile.orgId,
    expertProfileId: profile.id,
    resource: body.data.resource,
    resourceId: body.data.resourceId,
  })
  if (!owned) {
    return secureJson(
      { error: "not found", message: "resource not found" },
      { status: 404, headers }
    )
  }

  let modelId: string
  try {
    modelId = resolveEditorModelId()
  } catch (err) {
    if (err instanceof AiModelEnvMissingError) {
      return secureJson(
        { error: "misconfigured", code: err.code },
        { status: 503, headers }
      )
    }
    if (err instanceof AiModelNotApprovedError) {
      return secureJson(
        { error: "misconfigured", code: err.code },
        { status: 503, headers }
      )
    }
    throw err
  }

  try {
    const result = editorAssist(
      {
        command: body.data.command,
        text: body.data.text,
        sourceLocale: body.data.sourceLocale,
        targetLocale: body.data.targetLocale,
        context: body.data.context,
      },
      {
        abortSignal: request.signal,
        maxOutputTokens: 2048,
        onFinish: ({ usage }) => {
          console.info("[ai/editor]", {
            command: body.data.command,
            context: body.data.context,
            resource: body.data.resource,
            resourceId: body.data.resourceId,
            orgId: profile.orgId,
            modelId,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            latencyMs: Date.now() - startedAt,
          })
        },
      }
    )

    return result.toTextStreamResponse({ headers })
  } catch (err) {
    if (err instanceof AiClinicalContextRejectedError) {
      return secureJson(
        { error: "forbidden", code: err.code, message: err.message },
        { status: 403, headers }
      )
    }
    if (err instanceof AiTranslateLocaleRequiredError) {
      return secureJson(
        { error: "validation", code: err.code, message: err.message },
        { status: 422, headers }
      )
    }
    if (err instanceof AiModelNotApprovedError) {
      return secureJson(
        { error: "misconfigured", code: err.code },
        { status: 503, headers }
      )
    }
    if (err instanceof AiModelEnvMissingError) {
      return secureJson(
        { error: "misconfigured", code: err.code },
        { status: 503, headers }
      )
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson({ error: "internal", message }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
