import { describeError } from "@eleva/observability"
import {
  CreateOrganizationRequestSchema,
  CreateWorkspaceRequestSchema,
} from "@eleva/api-client"
import {
  createElevaOrganization,
  EXPERT_PRACTICE_EXISTS,
  findOwnedExpertPractice,
} from "@eleva/auth"
import { expertWorkspaceBase } from "@eleva/config/routing"
import { provisionOrgBilling } from "@eleva/billing/server"
import { getOrganizationBySlug } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import {
  apiAuthFailure,
  requireApiAuth,
  requirePrivilegedApiAuth,
} from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { UnauthorizedError } from "@eleva/auth"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isPracticeConflict(err: unknown): boolean {
  const body = (err as { body?: { code?: unknown } } | null)?.body
  return body?.code === EXPERT_PRACTICE_EXISTS
}

function practiceExists(slug: string, headers: HeadersInit) {
  return secureJson(
    {
      error: EXPERT_PRACTICE_EXISTS,
      code: EXPERT_PRACTICE_EXISTS,
      message:
        "You already have an expert practice. Add specialties and services there instead of creating another one.",
      slug,
      path: expertWorkspaceBase(slug),
    },
    { status: 409, headers }
  )
}

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, GET, OPTIONS")

  let session
  try {
    session = await requirePrivilegedApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const botVerdict = await checkBot()
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const rawBody = await request.json().catch(() => ({}))
  const workspaceBody = CreateWorkspaceRequestSchema.safeParse(rawBody)
  const body = workspaceBody.success
    ? workspaceBody
    : CreateOrganizationRequestSchema.safeParse(rawBody)

  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  // One expert practice per person (ADR-026). Better Auth's
  // beforeCreateOrganization hook enforces it too; this answer names the
  // practice so a person or agent can go there instead.
  if (body.data.type === "expert") {
    const practice = await findOwnedExpertPractice(session.user.id)
    if (practice) return practiceExists(practice.slug, headers)
  }

  let result
  try {
    result = await createElevaOrganization({
      userId: session.user.id,
      name: body.data.name,
      type: body.data.type,
    })
  } catch (err) {
    // A request that raced this one created the practice after the check
    // above; the hook refused this one. Answer with the same 409.
    if (body.data.type === "expert" && isPracticeConflict(err)) {
      const practice = await findOwnedExpertPractice(session.user.id)
      if (practice) return practiceExists(practice.slug, headers)
    }
    throw err
  }

  if (result.created) {
    try {
      await provisionOrgBilling({
        orgId: result.orgId,
        orgName: body.data.name,
        orgType: body.data.type,
        actorUserId: session.user.id,
        email: session.user.email,
      })
    } catch (err) {
      console.warn(
        `[organizations] provisionOrgBilling failed for ${result.orgId}`,
        describeError(err)
      )
    }
  }

  return secureJson(
    {
      orgId: result.orgId,
      slug: result.slug,
      created: result.created,
    },
    { status: result.created ? 201 : 200, headers }
  )
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "POST, GET, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const url = new URL(request.url)
  const slug = url.searchParams.get("slug")

  if (!slug) {
    return secureJson(
      { error: "validation", message: "slug query parameter is required" },
      { status: 422, headers }
    )
  }

  const org = await getOrganizationBySlug(slug)

  if (!org) {
    return secureJson({ error: "not_found" }, { status: 404, headers })
  }

  return secureJson(org, { status: 200, headers, noStore: false })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, GET, OPTIONS"),
  })
}
