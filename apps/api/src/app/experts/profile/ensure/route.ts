import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { UnauthorizedError } from "@eleva/auth"
import { withAudit } from "@eleva/audit"
import { ensureExpertProfileForOrgDetailed } from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EnsureProfileSchema = z.object({
  orgSlug: z.string().min(1).max(30),
  displayName: z.string().min(1).max(200),
})

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

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

  const body = EnsureProfileSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const { profile } = await withAudit(
      { orgId: session.orgId, actorUserId: session.user.id },
      async (_tx, ctx) => {
        const result = await ensureExpertProfileForOrgDetailed({
          userId: session.user.id,
          orgId: session.orgId,
          orgSlug: body.data.orgSlug,
          displayName: body.data.displayName,
        })

        await ctx.emit({
          entity: "expert_profile",
          action: result.created ? "created" : "updated",
          entityId: result.profile.id,
          payload: result.created
            ? { userId: session.user.id, orgSlug: body.data.orgSlug }
            : { ensured: true },
        })

        return result
      }
    )

    return secureJson(
      {
        ok: true,
        profile: {
          id: profile.id,
          orgId: profile.orgId,
          userId: profile.userId,
          username: profile.username,
          displayName: profile.displayName,
          status: profile.status,
          metadata: profile.metadata,
        },
      },
      { status: 200, headers }
    )
  } catch (err) {
    console.error("[POST /experts/profile/ensure]", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
