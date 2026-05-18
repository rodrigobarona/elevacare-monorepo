import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { getExpertProfileByUserId, deleteDateOverride, main } from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "DELETE, OPTIONS")

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

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const { id } = await params

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const [override] = await tx
          .select({ scheduleId: main.dateOverrides.scheduleId })
          .from(main.dateOverrides)
          .where(eq(main.dateOverrides.id, id))
          .limit(1)

        await deleteDateOverride(profile.orgId, id, profile.id, tx)
        await ctx.emit({
          entity: "schedule",
          action: "updated",
          entityId: override?.scheduleId ?? id,
          payload: { action: "override_removed", overrideId: id },
        })
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "DELETE, OPTIONS"),
  })
}
