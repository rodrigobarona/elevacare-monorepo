import { timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { withAudit } from "@eleva/audit"
import { auth as authTables, db } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import {
  assertE2eBypassNotInProduction,
  isE2eAuthBypassMounted,
} from "@/lib/e2e-env"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(16),
})

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  assertE2eBypassNotInProduction()
  const headers = corsHeaders(request, "POST, OPTIONS")
  if (!isE2eAuthBypassMounted()) {
    return new Response(null, { status: 404, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, "e2e-verify-email"),
    RATE_LIMITS.e2eBypass,
    headers
  )
  if (rateLimited) return rateLimited

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return secureJson({ error: "validation" }, { status: 422, headers })
  }

  const expected = process.env.E2E_AUTH_BYPASS_TOKEN ?? ""
  if (!tokensMatch(parsed.data.token, expected)) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  const [user] = await db()
    .select({ id: authTables.user.id })
    .from(authTables.user)
    .where(eq(authTables.user.email, parsed.data.email))
    .limit(1)

  if (!user) {
    return secureJson({ error: "not_found" }, { status: 404, headers })
  }

  await db()
    .update(authTables.user)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(authTables.user.id, user.id))

  const [membership] = await db()
    .select({ orgId: authTables.member.organizationId })
    .from(authTables.member)
    .where(eq(authTables.member.userId, user.id))
    .limit(1)

  if (membership) {
    await withAudit(
      { orgId: membership.orgId, actorUserId: user.id },
      async (_tx, ctx) => {
        await ctx.emit({
          entity: "user",
          action: "email_verified",
          entityId: user.id,
          payload: { via: "e2e" },
        })
      }
    )
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
