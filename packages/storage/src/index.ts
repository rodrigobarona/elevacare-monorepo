/**
 * @eleva/storage
 *
 * Owns ALL @vercel/blob access for the platform — boundary lint
 * forbids `from "@vercel/blob"` outside of `@eleva/storage/*`.
 *
 * Sub-entrypoints:
 *   - "@eleva/storage"                  — server-side `put`/`del` helpers
 *   - "@eleva/storage/blob-upload-handler" — `handleUpload` wrapper (Route Handler)
 *   - "@eleva/storage/blob-upload-client"  — `"use client"` upload helper
 *
 * Two stores:
 *   - Public  (BLOB_READ_WRITE_TOKEN)         — avatars, marketing assets
 *   - Private (BLOB_PRIVATE_READ_WRITE_TOKEN) — expert documents, patient
 *     reports, PHI. Private blobs require a signed download URL generated
 *     server-side; the raw URL returns 403.
 *
 * Caller is responsible for:
 *   - Validating the file (MIME type + size cap of 10MB) BEFORE
 *     calling put().
 */

import { put, del, get, type PutBlobResult } from "@vercel/blob"
import { requireBlobEnv, requirePrivateBlobEnv } from "@eleva/config/env"
import { createHash } from "node:crypto"

const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

const MAX_DOC_BYTES = 10 * 1024 * 1024 // 10MB

export class UploadValidationError extends Error {
  readonly code:
    | "mime-not-allowed"
    | "too-large"
    | "empty-file"
    | "missing-name"
  constructor(code: UploadValidationError["code"], message: string) {
    super(message)
    this.code = code
    this.name = "UploadValidationError"
  }
}

export interface UploadedDocument {
  url: string
  pathname: string
  name: string
  kind: string
  contentType: string
  size: number
  hash: string
  uploadedAt: string
}

// ── Public blob helpers (avatars, marketing assets) ─────────────────

export interface UploadPublicBlobInput {
  /** Full pathname including prefix, e.g. `"avatar/profile/photo.jpg"`. */
  pathname: string
  /** File body. */
  body: ArrayBuffer | Buffer | Blob
  /** Detected MIME type. */
  contentType: string
}

export async function uploadPublicBlob(
  input: UploadPublicBlobInput
): Promise<{ url: string; pathname: string }> {
  const { BLOB_READ_WRITE_TOKEN } = requireBlobEnv()
  const result: PutBlobResult = await put(input.pathname, input.body, {
    access: "public",
    contentType: input.contentType,
    addRandomSuffix: true,
    token: BLOB_READ_WRITE_TOKEN,
  })
  return { url: result.url, pathname: result.pathname }
}

export async function deletePublicBlob(url: string): Promise<void> {
  const { BLOB_READ_WRITE_TOKEN } = requireBlobEnv()
  await del(url, { token: BLOB_READ_WRITE_TOKEN })
}

// ── Private blob helpers (expert documents, patient reports) ────────

export interface UploadPrivateDocumentInput {
  /** Pathname prefix, e.g. `"consultations/<id>"` or `"reports/<id>"`. */
  prefix: string
  /** Logical document kind within the prefix. */
  kind: string
  /** Original filename from the browser. */
  name: string
  /** Detected MIME type. */
  contentType: string
  /** File body. */
  body: ArrayBuffer | Buffer | Blob
}

export async function uploadPrivateDocument(
  input: UploadPrivateDocumentInput
): Promise<UploadedDocument> {
  validatePrivate(input)

  const { BLOB_PRIVATE_READ_WRITE_TOKEN } = requirePrivateBlobEnv()

  const buf = await asArrayBuffer(input.body)
  if (buf.byteLength === 0) {
    throw new UploadValidationError("empty-file", "uploaded file is empty")
  }
  if (buf.byteLength > MAX_DOC_BYTES) {
    throw new UploadValidationError(
      "too-large",
      `file exceeds ${MAX_DOC_BYTES} bytes`
    )
  }

  const hash = createHash("sha256").update(new Uint8Array(buf)).digest("hex")
  const safe = sanitizeFilename(input.name)
  const pathname = `${input.prefix}/${input.kind}/${hash.slice(0, 8)}-${safe}`

  const result: PutBlobResult = await put(pathname, buf, {
    access: "private",
    contentType: input.contentType,
    addRandomSuffix: true,
    token: BLOB_PRIVATE_READ_WRITE_TOKEN,
  })

  return {
    url: result.url,
    pathname: result.pathname,
    name: input.name,
    kind: input.kind,
    contentType: input.contentType,
    size: buf.byteLength,
    hash,
    uploadedAt: new Date().toISOString(),
  }
}

export async function deletePrivateDocument(url: string): Promise<void> {
  const { BLOB_PRIVATE_READ_WRITE_TOKEN } = requirePrivateBlobEnv()
  await del(url, { token: BLOB_PRIVATE_READ_WRITE_TOKEN })
}

/**
 * Stream a private blob for an authorized user. Returns null if
 * the blob no longer exists. The caller (an API route) is responsible
 * for auth checks before calling this.
 */
export async function getPrivateDocument(url: string) {
  const { BLOB_PRIVATE_READ_WRITE_TOKEN } = requirePrivateBlobEnv()
  return get(url, {
    access: "private",
    token: BLOB_PRIVATE_READ_WRITE_TOKEN,
  })
}

function validatePrivate(input: UploadPrivateDocumentInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new UploadValidationError("missing-name", "filename required")
  }
  if (!ALLOWED_DOC_MIME.has(input.contentType)) {
    throw new UploadValidationError(
      "mime-not-allowed",
      `${input.contentType} not allowed; expected pdf or image`
    )
  }
}

async function asArrayBuffer(
  body: ArrayBuffer | Buffer | Blob
): Promise<ArrayBuffer> {
  if (body instanceof ArrayBuffer) return body
  if (body instanceof Blob) return body.arrayBuffer()
  // Buffer
  return new Uint8Array(body).buffer
}

function sanitizeFilename(name: string): string {
  // Strip path separators + control chars, lowercase, collapse whitespace.
  const base = name.split(/[\\/]/).pop() ?? "file"
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

export {
  ALLOWED_DOC_MIME as ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOC_BYTES as MAX_DOCUMENT_BYTES,
}
