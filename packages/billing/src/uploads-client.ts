"use client"

/**
 * Client-side Vercel Blob upload helper, scoped to Become-Partner
 * application documents.
 *
 * Re-exports `upload()` from `@vercel/blob/client` so the rest of the
 * monorepo can stay free of `@vercel/blob/*` imports
 * (boundary lint enforces). Pair with the server route built on
 * `handleApplicationDocumentUpload()` from `@eleva/billing/uploads-handler`.
 *
 * Bundle: this module is `"use client"`-tagged so it never lands in
 * server bundles. Import from `@eleva/billing/uploads-client` only
 * inside React Client Components.
 */

import { upload as blobUpload } from "@vercel/blob/client"

type BlobUploadResult = Awaited<ReturnType<typeof blobUpload>>

export interface UploadApplicationDocumentClientInput {
  /** Logical document kind ('license', 'id', 'cv', etc.). */
  kind: string
  /** File from <input type="file"> or DataTransfer drop. */
  file: File
  /**
   * Route handler URL that wraps `handleApplicationDocumentUpload`.
   * Defaults to `/api/become-partner/upload`.
   */
  handleUploadUrl?: string
  /**
   * Optional progress callback. The Vercel Blob SDK supplies a
   * percentage (0–100) and bytes uploaded.
   */
  onUploadProgress?: (event: { percentage: number; loaded: number }) => void
  /**
   * Optional client payload that the route handler can read in its
   * `authorize` callback. Vercel Blob ships it verbatim as a string,
   * so callers JSON-stringify any structured data first.
   */
  clientPayload?: string
}

export interface UploadedApplicationDocumentClient {
  url: string
  pathname: string
  contentType: string
  size: number
  kind: string
  name: string
  /** ISO 8601 timestamp captured client-side when blobUpload resolved. */
  uploadedAt: string
}

/**
 * Uploads a single document file to Vercel Blob using a token minted
 * by the server route. Throws on validation/auth/network errors.
 */
export async function uploadApplicationDocumentClient(
  input: UploadApplicationDocumentClientInput
): Promise<UploadedApplicationDocumentClient> {
  const { kind, file } = input
  // Preserve the file extension when truncating: a name like
  // "very-long-medical-license-document-2024.pdf" must NOT collapse to
  // "very-long-medical-license-document-2" without an extension. We
  // split on the LAST `.`, sanitize both halves independently, and
  // budget the truncation so the extension always survives.
  const lastDot = file.name.lastIndexOf(".")
  const rawBase = lastDot > 0 ? file.name.slice(0, lastDot) : file.name
  const rawExt = lastDot > 0 ? file.name.slice(lastDot) : ""
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const ext = sanitize(rawExt).slice(0, 16)
  // Reserve room for the extension and the joining dot already in `ext`.
  const baseBudget = Math.max(1, 80 - ext.length)
  const base = sanitize(rawBase).slice(0, baseBudget)
  const safeName = `${base}${ext}`
  const pathname = `become-partner/${kind}/${safeName}`

  const result: BlobUploadResult = await blobUpload(pathname, file, {
    access: "public",
    handleUploadUrl: input.handleUploadUrl ?? "/api/become-partner/upload",
    contentType: file.type || undefined,
    clientPayload: input.clientPayload,
    onUploadProgress: (event) =>
      input.onUploadProgress?.({
        percentage: event.percentage,
        loaded: event.loaded,
      }),
  })
  const uploadedAt = new Date().toISOString()

  return {
    url: result.url,
    pathname: result.pathname,
    contentType: result.contentType,
    size: file.size,
    kind,
    name: file.name,
    uploadedAt,
  }
}
