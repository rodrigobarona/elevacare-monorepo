"use client"

/**
 * Browser half of a direct upload: asks the API for a presigned PUT, then
 * sends the file straight to R2. Pair with `POST /storage/upload`, then record
 * the returned `url` through the owning API route, which verifies the object.
 *
 * Bundle: this module is `"use client"`-tagged and imports no S3 code. Import
 * from `@eleva/storage/upload-client` only inside React Client Components.
 */

import type { CreateStorageUploadResponse } from "@eleva/api-client"

export interface UploadFileInput {
  /** Pathname prefix that groups uploads logically (e.g. `"avatar"`). */
  prefix: string
  /** Logical document / asset kind within the prefix. */
  kind: string
  /**
   * Owner id appended after `kind` (`prefix/kind/ownerId/file`) for
   * policies that scope pathnames to the uploader.
   */
  ownerId?: string
  /** File from <input type="file"> or DataTransfer drop. */
  file: File
  /** Absolute URL of `POST /storage/upload` on the API. */
  apiUploadUrl: string
  /**
   * Extra headers for the API request (e.g. `Authorization: Bearer <token>`
   * for cross-origin API routes where cookies are not available).
   */
  headers?: Record<string, string>
}

export interface UploadedFile {
  url: string
  pathname: string
}

function uploadPathname(input: UploadFileInput): string {
  const { prefix, kind, file } = input
  const lastDot = file.name.lastIndexOf(".")
  const rawBase = lastDot > 0 ? file.name.slice(0, lastDot) : file.name
  const rawExt = lastDot > 0 ? file.name.slice(lastDot) : ""
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const ext = sanitize(rawExt).slice(0, 16)
  const baseBudget = Math.max(1, 80 - ext.length)
  const base = sanitize(rawBase).slice(0, baseBudget)
  const folder = input.ownerId
    ? `${prefix}/${kind}/${input.ownerId}`
    : `${prefix}/${kind}`
  return `${folder}/${base}${ext}`
}

/**
 * Uploads a single file using a presigned URL minted by the API. Throws on
 * validation / auth / network errors.
 */
export async function uploadFile(
  input: UploadFileInput
): Promise<UploadedFile> {
  const { file } = input
  const presignResponse = await fetch(input.apiUploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...input.headers },
    body: JSON.stringify({
      pathname: uploadPathname(input),
      contentType: file.type,
      size: file.size,
    }),
  })
  if (!presignResponse.ok) {
    throw new Error(`upload rejected (${presignResponse.status})`)
  }
  const presigned =
    (await presignResponse.json()) as CreateStorageUploadResponse

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: presigned.method,
    headers: presigned.headers,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error(`upload failed (${uploadResponse.status})`)
  }
  return { url: presigned.url, pathname: presigned.pathname }
}
