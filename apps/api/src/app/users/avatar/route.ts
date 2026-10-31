import { AVATAR_UPLOAD, isAvatarUrl } from "@eleva/config/avatar-upload"
import { UpdateAvatarRequestSchema } from "@eleva/api-client"
import { getUserAvatarUrl, updateUserAvatarUrl } from "@eleva/db"
import { deletePublicObject } from "@eleva/storage"
import { withAudit } from "@eleva/audit"
import { corsHeaders } from "@/lib/cors"
import {
  apiAuthFailure,
  requireApiAuth,
  requirePrivilegedApiAuth,
} from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { isVerifiedPublicUpload } from "@/lib/verify-public-upload"
import { UnauthorizedError } from "@eleva/auth"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function tryDeleteAvatar(url: string | null): Promise<void> {
  if (!url) return
  try {
    await deletePublicObject(url)
  } catch (err) {
    console.warn("[users/avatar] failed to delete old avatar, continuing", err)
  }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, DELETE, OPTIONS")

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

  const avatarUrl = await getUserAvatarUrl(session.user.id, session.user.id)
  return secureJson({ avatarUrl }, { status: 200, headers, noStore: false })
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, DELETE, OPTIONS")

  let session
  try {
    session = await requirePrivilegedApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = UpdateAvatarRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  if (
    !(await isVerifiedPublicUpload(body.data.url, AVATAR_UPLOAD, isAvatarUrl))
  ) {
    return secureJson(
      { error: "validation", message: "url must be an uploaded avatar" },
      { status: 422, headers }
    )
  }

  const previousUrl = await getUserAvatarUrl(session.user.id, session.user.id)
  await withAudit(
    { orgId: session.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await updateUserAvatarUrl(
        session.user.id,
        body.data.url,
        session.user.id,
        tx
      )
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: session.user.id,
        payload: { field: "avatarUrl", hasNewValue: true },
      })
    }
  )
  if (previousUrl && previousUrl !== body.data.url) {
    await tryDeleteAvatar(previousUrl)
  }
  return secureJson({ ok: true }, { status: 200, headers })
}

export async function DELETE(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, DELETE, OPTIONS")

  let session
  try {
    session = await requirePrivilegedApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const previousUrl = await getUserAvatarUrl(session.user.id, session.user.id)
  await withAudit(
    { orgId: session.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await updateUserAvatarUrl(session.user.id, null, session.user.id, tx)
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: session.user.id,
        payload: { field: "avatarUrl", cleared: true },
      })
    }
  )
  await tryDeleteAvatar(previousUrl)
  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PUT, DELETE, OPTIONS"),
  })
}
