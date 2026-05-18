"use client"

/**
 * Client-side Vercel Blob upload helper.
 *
 * Re-exports `upload()` from `@vercel/blob/client` so the rest of the
 * monorepo can stay free of `@vercel/blob/*` imports (boundary lint
 * enforces). Pair with the API route built on `handleBlobUpload()`
 * from `@eleva/storage/blob-upload-handler`.
 *
 * Bundle: this module is `"use client"`-tagged so it never lands in
 * server bundles. Import from `@eleva/storage/blob-upload-client` only
 * inside React Client Components.
 */

import { upload as blobUpload } from "@vercel/blob/client"

type BlobUploadResult = Awaited<ReturnType<typeof blobUpload>>

export interface UploadBlobClientInput {
  /**
   * Pathname prefix that groups uploads logically (e.g.
   * `"avatar"`, `"profile-photo"`, `"clinic-logo"`).
   */
  prefix: string
  /** Logical document / asset kind within the prefix. */
  kind: string
  /** File from <input type="file"> or DataTransfer drop. */
  file: File
  /**
   * Absolute URL of the generic blob upload route on the API
   * (e.g. `https://api.eleva.care/blob/upload`).
   */
  handleUploadUrl: string
  /**
   * Extra headers sent with the token-minting request to
   * `handleUploadUrl` (e.g. `Authorization: Bearer <token>` for
   * cross-origin API routes where cookies are not available).
   */
  headers?: Record<string, string>
  /**
   * Optional progress callback. The Vercel Blob SDK supplies a
   * percentage (0–100) and bytes uploaded.
   */
  onUploadProgress?: (event: { percentage: number; loaded: number }) => void
  /**
   * Optional client payload forwarded to the server's `authorize`
   * callback. Vercel Blob ships it verbatim as a string, so callers
   * JSON-stringify any structured data first.
   */
  clientPayload?: string
}

export interface UploadedBlobClient {
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
 * Uploads a single file to Vercel Blob using a token minted by the
 * API route. Throws on validation / auth / network errors.
 */
export async function uploadBlobClient(
  input: UploadBlobClientInput
): Promise<UploadedBlobClient> {
  const { prefix, kind, file } = input

  const lastDot = file.name.lastIndexOf(".")
  const rawBase = lastDot > 0 ? file.name.slice(0, lastDot) : file.name
  const rawExt = lastDot > 0 ? file.name.slice(lastDot) : ""
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const ext = sanitize(rawExt).slice(0, 16)
  const baseBudget = Math.max(1, 80 - ext.length)
  const base = sanitize(rawBase).slice(0, baseBudget)
  const safeName = `${base}${ext}`
  const pathname = `${prefix}/${kind}/${safeName}`

  const result: BlobUploadResult = await blobUpload(pathname, file, {
    access: "public",
    handleUploadUrl: input.handleUploadUrl,
    headers: input.headers,
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
