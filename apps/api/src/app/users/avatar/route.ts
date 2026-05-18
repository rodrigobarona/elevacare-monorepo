import { z } from "zod"
import { getUserAvatarUrl, updateUserAvatarUrl } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const UpdateAvatarSchema = z.object({
  url: z.string().url(),
})

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

  const avatarUrl = await getUserAvatarUrl(session.user.id)
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

  await updateUserAvatarUrl(session.user.id, body.data.url)
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

  await updateUserAvatarUrl(session.user.id, null)
  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PUT, DELETE, OPTIONS"),
  })
}
