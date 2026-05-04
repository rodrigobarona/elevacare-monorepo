/**
 * Vercel Blob helper for Become-Partner application documents.
 *
 * Owns ALL @vercel/blob access for the platform — boundary lint
 * forbids `from "@vercel/blob"` outside of @eleva/billing/uploads.
 *
 * Public reads: the URLs Vercel Blob returns are public-by-default
 * but unguessable (path includes a random suffix). For PHI / fiscal
 * docs in S5+ we'll switch to private uploads via signed URLs.
 *
 * Caller is responsible for:
 *   - Validating the file (MIME type + size cap of 10MB) BEFORE
 *     calling put().
 *   - Wrapping the resulting URL in `documents` JSONB on the
 *     become_partner_applications row inside withAudit.
 */

import { put, del, type PutBlobResult } from "@vercel/blob"
import { requireBlobEnv } from "@eleva/config/env"
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

export interface UploadDocumentInput {
  /** ID of the application this document belongs to. */
  applicationId: string
  /** Logical document kind ('license', 'id', 'cv', etc.). */
  kind: string
  /** Original filename from the browser. */
  name: string
  /** Detected MIME type. */
  contentType: string
  /** File body (Buffer / ArrayBuffer / Blob from server action). */
  body: ArrayBuffer | Buffer | Blob
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

export async function uploadApplicationDocument(
  input: UploadDocumentInput
): Promise<UploadedDocument> {
  validate(input)

  const { BLOB_READ_WRITE_TOKEN } = requireBlobEnv()

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
  const pathname = `become-partner/${input.applicationId}/${input.kind}/${hash.slice(
    0,
    8
  )}-${safe}`

  const result: PutBlobResult = await put(pathname, buf, {
    access: "public",
    contentType: input.contentType,
    addRandomSuffix: true,
    token: BLOB_READ_WRITE_TOKEN,
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

export async function deleteApplicationDocument(url: string): Promise<void> {
  const { BLOB_READ_WRITE_TOKEN } = requireBlobEnv()
  await del(url, { token: BLOB_READ_WRITE_TOKEN })
}

function validate(input: UploadDocumentInput): void {
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
