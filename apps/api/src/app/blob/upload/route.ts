/**
 * POST /blob/upload
 *
 * Generic Vercel Blob client-upload endpoint. Any app in the monorepo
 * can upload files through this single route by providing a sealed
 * upload token (minted via `@eleva/auth/upload-token`) and a pathname
 * whose prefix is registered in UPLOAD_POLICIES below.
 *
 * Adding a new upload flow:
 *   1. Add an entry to UPLOAD_POLICIES with a pathname regex.
 *   2. The client passes `prefix` + `kind` via `uploadBlobClient()`.
 *   3. Done — no new route needed.
 *
 * CORS: browsers on eleva.care / *.preview.eleva.care are allowed.
 */

import { handleBlobUpload } from "@eleva/storage/blob-upload-handler"
import { verifyUploadToken } from "@eleva/auth/upload-token"
import { corsHeaders } from "@/lib/cors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ── Upload policies ─────────────────────────────────────────────────
// Each policy maps a pathname prefix to its validation rules.
// The `match` function receives the full pathname and returns the
// logical `kind` string on success, or `null` to reject.

interface UploadPolicy {
  match: (pathname: string) => string | null
  allowedContentTypes?: readonly string[]
  maxBytes?: number
}

const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

const AVATAR_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

const UPLOAD_POLICIES: Record<string, UploadPolicy> = {
  "become-partner": {
    match: (pathname) => {
      const m = pathname.match(
        /^become-partner\/(license|id|cv|professional_insurance)\/[^/]+$/
      )
      return m ? m[1]! : null
    },
  },
  avatar: {
    match: (pathname) => {
      const m = pathname.match(/^avatar\/profile\/[^/]+$/)
      return m ? "profile" : null
    },
    allowedContentTypes: AVATAR_CONTENT_TYPES,
    maxBytes: AVATAR_MAX_BYTES,
  },
}

function resolvePolicy(
  pathname: string
): { policy: UploadPolicy; kind: string } | null {
  for (const [, policy] of Object.entries(UPLOAD_POLICIES)) {
    const kind = policy.match(pathname)
    if (kind) return { policy, kind }
  }
  return null
}

// ── Route handlers ──────────────────────────────────────────────────

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request, "POST, OPTIONS")

  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

    return await handleBlobUpload({
      request,
      responseHeaders: cors,
      authorize: async (pathname) => {
        if (!token) {
          console.error("[blob/upload] no bearer token in Authorization header")
          throw new Error("unauthorized")
        }
        const verified = await verifyUploadToken(token)
        if (!verified) {
          console.error("[blob/upload] upload token verification failed")
          throw new Error("unauthorized")
        }

        const resolved = resolvePolicy(pathname)
        if (!resolved) throw new Error("invalid-pathname")

        return {
          userId: verified.userId,
          kind: resolved.kind,
          allowedContentTypes: resolved.policy.allowedContentTypes,
          maxBytes: resolved.policy.maxBytes,
        }
      },
    })
  } catch (err) {
    console.error("blob upload failed", err)
    return Response.json(
      { error: "upload-rejected" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store", ...cors },
      }
    )
  }
}
