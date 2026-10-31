/**
 * @eleva/storage
 *
 * Owns ALL object storage for the platform (Cloudflare R2 over the S3 API,
 * ADR-025) — boundary lint forbids `@aws-sdk/*` outside of `@eleva/storage/*`.
 *
 * Sub-entrypoints:
 *   - "@eleva/storage"                — server-side put/head/get/delete helpers
 *   - "@eleva/storage/upload-handler" — presigned PUT + post-upload verification
 *   - "@eleva/storage/upload-client"  — `"use client"` upload helper
 *
 * Two EU jurisdiction buckets, each with its own credentials:
 *   - Public  — avatars, marketing assets. Served from the media host.
 *   - Private — member documents, reports, health data, exports. Never gets a
 *     browser-facing URL: API routes authorize, then stream
 *     `getPrivateDocument()`.
 *
 * Private objects are addressed by key. `blob_pathname` and `blob_url` columns
 * both hold the key.
 */

import { mediaKeyFromUrl, mediaUrl } from "@eleva/config/media-host"
import {
  deleteObject,
  getObjectStream,
  headObject,
  putObject,
  withRandomSuffix,
  type ObjectMetadata,
} from "./r2"

/** Public keys carry a random suffix or a curated path: they never change. */
const PUBLIC_CACHE_CONTROL = "public, max-age=31536000, immutable"

const e2ePrivateObjects = new Map<
  string,
  { body: Buffer; contentType: string }
>()

function e2ePrivateStorageMockEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  ) {
    return false
  }
  return (
    process.env.E2E_MOCK_PRIVATE_STORAGE === "1" ||
    process.env.E2E_AUTH_CAPTURE === "1"
  )
}

function bufferToStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf))
      controller.close()
    },
  })
}

type ObjectBody = ArrayBuffer | Buffer | Blob

async function asNodeBuffer(body: ObjectBody): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  return Buffer.from(await body.arrayBuffer())
}

export interface UploadObjectInput {
  /** Full key including prefix, e.g. `"avatar/profile/photo.jpg"`. */
  pathname: string
  body: ObjectBody
  contentType: string
  /**
   * When true, keep the given key and replace any existing object there.
   * Default adds a random suffix so callers cannot clobber another key.
   */
  overwrite?: boolean
}

// ── Public bucket (avatars, marketing assets) ───────────────────────

export async function uploadPublicObject(
  input: UploadObjectInput
): Promise<{ url: string; pathname: string }> {
  const pathname = input.overwrite
    ? input.pathname
    : withRandomSuffix(input.pathname)
  await putObject("public", {
    key: pathname,
    body: await asNodeBuffer(input.body),
    contentType: input.contentType,
    cacheControl: PUBLIC_CACHE_CONTROL,
  })
  return { url: mediaUrl(pathname), pathname }
}

export function headPublicObject(
  pathname: string
): Promise<ObjectMetadata | null> {
  return headObject("public", pathname)
}

/** No-op for URLs off the media host, such as an OAuth profile picture. */
export async function deletePublicObject(url: string): Promise<void> {
  const key = mediaKeyFromUrl(url)
  if (key) await deleteObject("public", key)
}

// ── Private bucket (member documents, health data, exports) ─────────

export type PrivateDocumentResult = {
  stream: ReadableStream<Uint8Array>
} | null

/** Private-bucket put for server-generated artifacts (DSAR and SAF-T zips). */
export async function uploadPrivateObject(
  input: UploadObjectInput
): Promise<{ pathname: string }> {
  const body = await asNodeBuffer(input.body)
  if (e2ePrivateStorageMockEnabled()) {
    e2ePrivateObjects.set(input.pathname, {
      body,
      contentType: input.contentType,
    })
    return { pathname: input.pathname }
  }
  const pathname = input.overwrite
    ? input.pathname
    : withRandomSuffix(input.pathname)
  await putObject("private", {
    key: pathname,
    body,
    contentType: input.contentType,
  })
  return { pathname }
}

/** Deleting a key that no longer exists succeeds. */
export async function deletePrivateDocument(pathname: string): Promise<void> {
  if (e2ePrivateStorageMockEnabled()) {
    e2ePrivateObjects.delete(pathname)
    return
  }
  await deleteObject("private", pathname)
}

/**
 * Look up a private object by key. Returns null when the object is missing.
 * Callers must authorize the key before persisting it.
 */
export async function headPrivateDocument(
  pathname: string
): Promise<ObjectMetadata | null> {
  if (e2ePrivateStorageMockEnabled()) {
    const stored = e2ePrivateObjects.get(pathname)
    if (!stored) return null
    return {
      pathname,
      contentType: stored.contentType,
      size: stored.body.byteLength,
    }
  }
  return headObject("private", pathname)
}

/**
 * Stream a private object for an authorized user. Returns null if it no
 * longer exists. The caller (an API route) is responsible for auth checks
 * before calling this.
 */
export async function getPrivateDocument(
  pathname: string
): Promise<PrivateDocumentResult> {
  if (e2ePrivateStorageMockEnabled()) {
    const stored = e2ePrivateObjects.get(pathname)
    return stored ? { stream: bufferToStream(stored.body) } : null
  }
  const stream = await getObjectStream("private", pathname)
  return stream ? { stream } : null
}

export type { ObjectMetadata } from "./r2"
