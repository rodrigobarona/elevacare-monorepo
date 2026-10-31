/**
 * POST /storage/upload
 *
 * Generic presigned upload to the public bucket. Any app can upload through
 * this single route with a sealed upload token (minted via
 * `@eleva/auth/upload-token`) and a pathname matching UPLOAD_POLICIES below.
 * The route that records the returned URL verifies the object (ADR-025).
 *
 * Adding a new upload flow:
 *   1. Add an entry to UPLOAD_POLICIES with a pathname matcher.
 *   2. The client passes `prefix` + `kind` via `uploadFile()`.
 *   3. Call `isVerifiedPublicUpload()` in the route that records the URL.
 *
 * CORS: browsers on eleva.care / *.preview.eleva.care are allowed.
 */

import {
  CreateStorageUploadRequestSchema,
  CreateStorageUploadResponseSchema,
} from "@eleva/api-client"
import { verifyUploadToken } from "@eleva/auth/upload-token"
import {
  AVATAR_PATHNAME,
  AVATAR_UPLOAD,
  avatarKey,
} from "@eleva/config/avatar-upload"
import {
  EXPERT_PORTRAIT_PATHNAME,
  EXPERT_PORTRAIT_UPLOAD,
} from "@eleva/config/expert-profile-content"
import { mediaUrl } from "@eleva/config/media-host"
import {
  createUploadUrl,
  UploadRejectedError,
} from "@eleva/storage/upload-handler"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "signature",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ── Upload policies ─────────────────────────────────────────────────
// Each policy decides whether the verified uploader may write a pathname.

interface UploadPolicy {
  allows: (pathname: string, userId: string) => boolean
  /** Final object key, when the server decides it. */
  key?: (pathname: string, userId: string) => string
  contentTypes: readonly string[]
  maxBytes: number
}

const UPLOAD_POLICIES: readonly UploadPolicy[] = [
  {
    allows: (pathname) => AVATAR_PATHNAME.test(pathname),
    key: avatarKey,
    contentTypes: AVATAR_UPLOAD.contentTypes,
    maxBytes: AVATAR_UPLOAD.maxBytes,
  },
  {
    // Portraits live under the uploader's own id so a profile can only
    // reference (and later delete) its owner's files.
    allows: (pathname, userId) =>
      EXPERT_PORTRAIT_PATHNAME.exec(pathname)?.[1] === userId,
    contentTypes: EXPERT_PORTRAIT_UPLOAD.contentTypes,
    maxBytes: EXPERT_PORTRAIT_UPLOAD.maxBytes,
  },
]

// ── Route handlers ──────────────────────────────────────────────────

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")

  const rateLimited = await applyRateLimit(
    rateLimitKey(request),
    RATE_LIMITS.public,
    headers
  )
  if (rateLimited) return rateLimited

  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const verified = token ? await verifyUploadToken(token) : null
  if (!verified) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  const body = CreateStorageUploadRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const { pathname, contentType, size } = body.data
  const policy = UPLOAD_POLICIES.find((p) =>
    p.allows(pathname, verified.userId)
  )
  if (!policy) {
    return secureJson({ error: "upload-rejected" }, { status: 422, headers })
  }

  try {
    const upload = await createUploadUrl({
      store: "public",
      pathname: policy.key?.(pathname, verified.userId) ?? pathname,
      contentType,
      size,
      allowedContentTypes: policy.contentTypes,
      maxBytes: policy.maxBytes,
    })
    return secureJson(
      CreateStorageUploadResponseSchema.parse({
        ...upload,
        url: mediaUrl(upload.pathname),
      }),
      { headers }
    )
  } catch (err) {
    if (err instanceof UploadRejectedError) {
      return secureJson(
        { error: "upload-rejected", reason: err.code },
        { status: 422, headers }
      )
    }
    console.error("[storage/upload] presign failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}
