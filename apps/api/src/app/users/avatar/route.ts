import { z } from "zod"
import { getUserAvatarUrl, updateUserAvatarUrl } from "@eleva/db"
import { deletePublicBlob } from "@eleva/storage"
import { verifyUploadToken } from "@eleva/auth/upload-token"
import { withAudit } from "@eleva/audit"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BLOB_HOST_PATTERN = /\.public\.blob\.vercel-storage\.com$/

const UpdateAvatarSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          return BLOB_HOST_PATTERN.test(new URL(url).hostname)
        } catch {
          return false
        }
      },
      { message: "URL must be a Vercel Blob public store URL" }
    ),
})

async function resolveUserId(request: Request): Promise<string> {
  try {
    const session = await requireApiAuth(request)
    return session.user.id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) throw new UnauthorizedError("no-session")

  const verified = await verifyUploadToken(token)
  if (!verified) throw new UnauthorizedError("no-session")
  return verified.userId
}

async function tryDeleteBlob(url: string | null): Promise<void> {
  if (!url) return
  try {
    await deletePublicBlob(url)
  } catch (err) {
    console.warn("[users/avatar] failed to delete old blob, continuing", err)
  }
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, PUT, DELETE, OPTIONS")

  let userId: string
  try {
    userId = await resolveUserId(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, userId),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const avatarUrl = await getUserAvatarUrl(userId)
  return secureJson({ avatarUrl }, { status: 200, headers, noStore: false })
}

export async function PUT(request: Request) {
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

  const body = UpdateAvatarSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const previousUrl = await getUserAvatarUrl(session.user.id)
  await withAudit(
    { orgId: session.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await updateUserAvatarUrl(session.user.id, body.data.url, tx)
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: session.user.id,
        payload: { field: "avatarUrl", hasNewValue: true },
      })
    }
  )
  await tryDeleteBlob(previousUrl)
  return secureJson({ ok: true }, { status: 200, headers })
}

export async function DELETE(request: Request) {
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

  const previousUrl = await getUserAvatarUrl(session.user.id)
  await withAudit(
    { orgId: session.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await updateUserAvatarUrl(session.user.id, null, tx)
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: session.user.id,
        payload: { field: "avatarUrl", cleared: true },
      })
    }
  )
  await tryDeleteBlob(previousUrl)
  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PUT, DELETE, OPTIONS"),
  })
}
