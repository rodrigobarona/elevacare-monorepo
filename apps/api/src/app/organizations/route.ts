import { z } from "zod"
import { provisionOrganization } from "@eleva/auth"
import { getWorkOS } from "@eleva/auth/server"
import { getOrganizationBySlug } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { UnauthorizedError } from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  type: z.enum(["personal", "expert", "team", "staff"]).default("personal"),
})

export async function POST(request: Request) {
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

  const botVerdict = await checkBot()
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = CreateOrgSchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const workos = getWorkOS()
  const workosOrg = await workos.organizations.createOrganization({
    name: body.data.name,
  })

  const result = await provisionOrganization({
    workosOrgId: workosOrg.id,
    name: body.data.name,
    type: body.data.type,
  })

  await Promise.allSettled([
    workos.organizations.updateOrganization({
      organization: workosOrg.id,
      externalId: result.orgId,
      metadata: { slug: result.slug },
    }),
  ])

  return secureJson(
    {
      orgId: result.orgId,
      slug: result.slug,
      workosOrgId: workosOrg.id,
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
