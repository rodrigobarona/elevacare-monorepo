/**
 * Browser uploads go straight to R2 on a short-lived presigned PUT.
 *
 * Flow:
 *   1. API route authorizes the caller and the pathname, then calls
 *      `createUploadUrl()`.
 *   2. Browser PUTs the file to `uploadUrl` with the returned `headers`.
 *   3. The API route that records the object calls `verifyUpload()`: HEAD,
 *      check size and type, delete the object if it breaks the limit.
 *
 * Step 3 must sit in the recording route so a caller cannot skip it. R2 is not
 * documented to enforce a signed Content-Length, so the size in step 1 is only
 * a fast rejection and the HEAD in step 3 is the real limit.
 *
 * Content-Type and `If-None-Match: *` are signed: a mismatched type fails with
 * 403, and a URL cannot be replayed to overwrite an object that has already
 * passed `verifyUpload()`.
 */

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import {
  deleteObject,
  headObject,
  r2Bucket,
  withRandomSuffix,
  type ObjectMetadata,
  type StorageStore,
} from "./r2"

export const UPLOAD_URL_TTL_SECONDS = 300

export type UploadRejectionCode =
  | "not-found"
  | "empty"
  | "too-large"
  | "type-not-allowed"

export class UploadRejectedError extends Error {
  readonly code: UploadRejectionCode
  constructor(code: UploadRejectionCode) {
    super(`upload rejected: ${code}`)
    this.code = code
    this.name = "UploadRejectedError"
  }
}

interface UploadLimits {
  allowedContentTypes: readonly string[]
  maxBytes: number
}

export interface PresignedUpload {
  uploadUrl: string
  method: "PUT"
  /** Must be sent verbatim on the PUT or the signature fails. */
  headers: Record<string, string>
  /** Final object key, with its random suffix. */
  pathname: string
  expiresAt: string
}

/**
 * Presign a PUT for an authorized pathname. Authorization and pathname rules
 * belong to the caller; a random suffix is always added.
 */
export async function createUploadUrl(
  input: UploadLimits & {
    store: StorageStore
    pathname: string
    contentType: string
    size: number
  }
): Promise<PresignedUpload> {
  if (!input.allowedContentTypes.includes(input.contentType)) {
    throw new UploadRejectedError("type-not-allowed")
  }
  if (input.size <= 0) throw new UploadRejectedError("empty")
  if (input.size > input.maxBytes) throw new UploadRejectedError("too-large")

  const { client, bucket } = r2Bucket(input.store)
  const pathname = withRandomSuffix(input.pathname)
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000)
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: pathname,
      ContentType: input.contentType,
      IfNoneMatch: "*",
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // The presigner leaves Content-Type unsigned unless told otherwise.
      signableHeaders: new Set(["content-type", "if-none-match"]),
    }
  )
  return {
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": input.contentType, "If-None-Match": "*" },
    pathname,
    expiresAt: expiresAt.toISOString(),
  }
}

/**
 * Confirm an uploaded object against its limits before it is recorded. An
 * object that breaks them is deleted, then `UploadRejectedError` is thrown.
 */
export async function verifyUpload(
  input: UploadLimits & { store: StorageStore; pathname: string }
): Promise<ObjectMetadata> {
  const object = await headObject(input.store, input.pathname)
  if (!object) throw new UploadRejectedError("not-found")

  const contentType = object.contentType.split(";")[0]?.trim() ?? ""
  const rejection: UploadRejectionCode | null =
    object.size === 0
      ? "empty"
      : object.size > input.maxBytes
        ? "too-large"
        : input.allowedContentTypes.includes(contentType)
          ? null
          : "type-not-allowed"
  if (rejection) {
    await deleteObject(input.store, input.pathname)
    throw new UploadRejectedError(rejection)
  }
  return { ...object, contentType }
}
