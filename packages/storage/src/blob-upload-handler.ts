/**
 * Generic server-side handler for client-driven Vercel Blob uploads.
 *
 * Wraps `@vercel/blob/client.handleUpload` behind a single
 * `handleBlobUpload()` function that any API route can call. The
 * caller supplies an `authorize` callback (auth + pathname validation)
 * and optionally overrides MIME types, size limits, and completion
 * hooks.
 *
 * Owns ALL `@vercel/blob/client.handleUpload` access for the platform
 * — boundary lint forbids `from "@vercel/blob/client"` outside
 * `@eleva/storage/*`.
 *
 * Flow:
 *   browser ──upload(pathname, file)──▶ Vercel Blob (with token)
 *      ▲                                         │
 *      │                                         ▼
 *      └──onBeforeGenerateToken──── Route ─◀───handleUpload────┘
 *                                    │
 *                                    └─authorise + emit token (TTL ~60s)
 *
 * The route handler can run cross-origin (e.g. on api.eleva.care)
 * provided the caller sends auth via custom `headers` and CORS is
 * configured on the route. See `@eleva/auth/upload-token` for the
 * sealed-token approach used when cookies are not available.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { requireBlobEnv } from "@eleva/config/env"

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// ── Public types ────────────────────────────────────────────────────

export interface BlobUploadTokenPayload {
  userId: string
  kind: string
}

export interface BlobUploadCompletedPayload {
  userId: string
  kind: string
  url: string
  pathname: string
  contentType: string | null
}

export interface AuthorizeResult extends BlobUploadTokenPayload {
  /** Per-request MIME type override; takes precedence over top-level default. */
  allowedContentTypes?: readonly string[]
  /** Per-request size limit override; takes precedence over top-level default. */
  maxBytes?: number
}

export interface HandleBlobUploadInput {
  request: Request

  /**
   * Authorise the request before a client upload token is minted.
   * Throw to reject. Return a payload that identifies the user and
   * the logical upload kind; it is sealed into the Blob token and
   * echoed back on `onCompleted`.
   *
   * Optionally return `allowedContentTypes` / `maxBytes` to override
   * the top-level defaults on a per-pathname basis.
   */
  authorize: (
    pathname: string,
    clientPayload: string | null
  ) => Promise<AuthorizeResult> | AuthorizeResult

  /**
   * MIME types accepted by this upload. Defaults to PDF + common
   * image formats. Can be overridden per-request via `authorize`.
   */
  allowedContentTypes?: readonly string[]

  /** Maximum file size in bytes. Defaults to 10 MB.
   *  Can be overridden per-request via `authorize`. */
  maxBytes?: number

  /**
   * Called by Vercel Blob (server-to-server) after the upload
   * finishes. Use it to persist the blob URL in your database.
   */
  onCompleted?: (payload: BlobUploadCompletedPayload) => Promise<void> | void

  /**
   * Extra headers merged into the JSON response (e.g. CORS headers
   * when the route runs on a different origin than the web app).
   */
  responseHeaders?: Record<string, string>
}

// ── Handler ─────────────────────────────────────────────────────────

/**
 * Generic Vercel Blob client-upload handler. The Route Handler should
 * NOT pre-read the request body — `handleUpload` reads it itself.
 */
export async function handleBlobUpload(
  input: HandleBlobUploadInput
): Promise<Response> {
  const { BLOB_READ_WRITE_TOKEN } = requireBlobEnv()
  const body = (await input.request.json()) as HandleUploadBody

  const fallbackContentTypes = input.allowedContentTypes
    ? [...input.allowedContentTypes]
    : [...DEFAULT_ALLOWED_CONTENT_TYPES]
  const fallbackMaxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES

  const json = await handleUpload({
    body,
    request: input.request,
    token: BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const decision = await input.authorize(pathname, clientPayload)

      const contentTypes = decision.allowedContentTypes
        ? [...decision.allowedContentTypes]
        : fallbackContentTypes
      const maxSize = decision.maxBytes ?? fallbackMaxBytes

      return {
        allowedContentTypes: contentTypes,
        addRandomSuffix: true,
        maximumSizeInBytes: maxSize,
        tokenPayload: JSON.stringify({
          userId: decision.userId,
          kind: decision.kind,
        }),
      }
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!input.onCompleted) return
      if (!tokenPayload) {
        console.error(
          "[blob-upload] onUploadCompleted received empty tokenPayload; skipping"
        )
        return
      }
      let decoded: Partial<BlobUploadTokenPayload>
      try {
        decoded = JSON.parse(tokenPayload) as Partial<BlobUploadTokenPayload>
      } catch (err) {
        console.error("[blob-upload] failed to parse tokenPayload", err)
        return
      }
      if (
        typeof decoded.userId !== "string" ||
        decoded.userId.length === 0 ||
        typeof decoded.kind !== "string" ||
        decoded.kind.length === 0
      ) {
        console.error(
          "[blob-upload] tokenPayload missing required fields; skipping",
          {
            hasUserId: Boolean(decoded.userId),
            hasKind: Boolean(decoded.kind),
          }
        )
        return
      }
      await input.onCompleted({
        userId: decoded.userId,
        kind: decoded.kind,
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType ?? null,
      })
    },
  })

  return Response.json(json, {
    headers: input.responseHeaders,
  })
}

// ── Re-exports for callers that need the defaults ───────────────────

export { DEFAULT_ALLOWED_CONTENT_TYPES, DEFAULT_MAX_BYTES }
