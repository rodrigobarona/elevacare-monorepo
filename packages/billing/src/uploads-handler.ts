/**
 * Server-side handler for client-driven Vercel Blob uploads.
 *
 * Used by Become-Partner so applicants can upload documents up to 10MB
 * directly from the browser to Vercel Blob, bypassing Next.js's
 * Server Action body limit. The client component calls
 * `uploadApplicationDocumentClient()` (uploads-client.tsx) which talks
 * to a Route Handler that delegates to
 * `handleApplicationDocumentUpload()` below.
 *
 * Owns ALL `@vercel/blob/client.handleUpload` access for the platform
 * — boundary lint forbids `from "@vercel/blob/client"` outside
 * `@eleva/billing/*`.
 *
 * Flow:
 *   browser ──upload(pathname, file)──▶ Vercel Blob (with token)
 *      ▲                                         │
 *      │                                         ▼
 *      └──onBeforeGenerateToken──── Route ─◀───handleUpload────┘
 *                                    │
 *                                    └─authorise + emit token (TTL ~60s)
 *
 * The route handler MUST sit at the same origin as the page that uses
 * the client `upload()` helper (cookies + CORS).
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { requireBlobEnv } from "@eleva/config/env"

const ALLOWED_DOC_MIME_LIST = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const MAX_DOC_BYTES = 10 * 1024 * 1024

export interface ApplicationUploadTokenPayload {
  applicantUserId: string
  kind: string
}

export interface ApplicationUploadCompletedPayload {
  applicantUserId: string
  kind: string
  url: string
  pathname: string
  contentType: string | null
}

export interface HandleApplicationUploadInput {
  request: Request
  /**
   * Authorise the request before a client upload token is minted.
   * Throw to reject. Return a token payload that will be echoed back
   * on `onUploadCompleted` so the caller can audit/persist the doc.
   */
  authorize: (
    pathname: string,
    clientPayload: string | null
  ) => Promise<ApplicationUploadTokenPayload> | ApplicationUploadTokenPayload
  /**
   * Persist the uploaded blob URL onto the application row. Called by
   * Vercel Blob after the upload finishes (server-to-server).
   */
  onCompleted?: (
    payload: ApplicationUploadCompletedPayload
  ) => Promise<void> | void
}

/**
 * Wraps `@vercel/blob/client.handleUpload`. The Route Handler should
 * NOT pre-read the request body — handleUpload reads it itself.
 */
export async function handleApplicationDocumentUpload(
  input: HandleApplicationUploadInput
): Promise<Response> {
  const { BLOB_READ_WRITE_TOKEN } = requireBlobEnv()
  const body = (await input.request.json()) as HandleUploadBody

  const json = await handleUpload({
    body,
    request: input.request,
    token: BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const decision = await input.authorize(pathname, clientPayload)
      return {
        allowedContentTypes: [...ALLOWED_DOC_MIME_LIST],
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_DOC_BYTES,
        tokenPayload: JSON.stringify(decision),
      }
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!input.onCompleted) return
      if (!tokenPayload) {
        console.error(
          "[uploads-handler] onUploadCompleted received empty tokenPayload; skipping persistence"
        )
        return
      }
      let decoded: Partial<ApplicationUploadTokenPayload>
      try {
        decoded = JSON.parse(
          tokenPayload
        ) as Partial<ApplicationUploadTokenPayload>
      } catch (err) {
        console.error("[uploads-handler] failed to parse tokenPayload", err)
        return
      }
      if (
        typeof decoded.applicantUserId !== "string" ||
        decoded.applicantUserId.length === 0 ||
        typeof decoded.kind !== "string" ||
        decoded.kind.length === 0
      ) {
        console.error(
          "[uploads-handler] tokenPayload missing required fields; skipping persistence",
          {
            hasApplicantUserId: Boolean(decoded.applicantUserId),
            hasKind: Boolean(decoded.kind),
          }
        )
        return
      }
      await input.onCompleted({
        applicantUserId: decoded.applicantUserId,
        kind: decoded.kind,
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType ?? null,
      })
    },
  })

  return Response.json(json)
}

export {
  ALLOWED_DOC_MIME_LIST as ALLOWED_DOCUMENT_MIME_LIST,
  MAX_DOC_BYTES as MAX_APPLICATION_DOC_BYTES,
}
