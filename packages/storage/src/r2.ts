import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import {
  requireR2PrivateEnv,
  requireR2PublicEnv,
  type R2BucketEnv,
} from "@eleva/config/env"
import { randomBytes } from "node:crypto"

/**
 * Public bucket for avatars and marketing assets, private bucket for member
 * documents, health data and exports. Each has its own bucket-scoped
 * credentials (ADR-025).
 */
export type StorageStore = "public" | "private"

export interface R2Bucket {
  client: S3Client
  bucket: string
}

export interface ObjectMetadata {
  pathname: string
  contentType: string
  size: number
}

const clients = new Map<string, S3Client>()

function clientFor(config: R2BucketEnv): S3Client {
  const cacheKey = `${config.endpoint}|${config.accessKeyId}`
  const existing = clients.get(cacheKey)
  if (existing) return existing
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // SDK defaults since 3.729 add CRC32 checksums that R2 does not fully
    // support, and would bake them into presigned PUT URLs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
  clients.set(cacheKey, client)
  return client
}

export function r2Bucket(store: StorageStore): R2Bucket {
  const config =
    store === "private" ? requireR2PrivateEnv() : requireR2PublicEnv()
  return { client: clientFor(config), bucket: config.bucket }
}

/** `photo.jpg` → `photo-<random>.jpg`, so uploads never collide. */
export function withRandomSuffix(pathname: string): string {
  const suffix = randomBytes(16).toString("hex")
  const dot = pathname.lastIndexOf(".")
  return dot > pathname.lastIndexOf("/") + 1
    ? `${pathname.slice(0, dot)}-${suffix}${pathname.slice(dot)}`
    : `${pathname}-${suffix}`
}

function isNotFound(err: unknown): boolean {
  return (
    (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode === 404
  )
}

export async function putObject(
  store: StorageStore,
  input: {
    key: string
    body: Buffer
    contentType: string
    cacheControl?: string
  }
): Promise<void> {
  const { client, bucket } = r2Bucket(store)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    })
  )
}

export async function headObject(
  store: StorageStore,
  key: string
): Promise<ObjectMetadata | null> {
  const { client, bucket } = r2Bucket(store)
  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    )
    return {
      pathname: key,
      contentType: result.ContentType ?? "application/octet-stream",
      size: result.ContentLength ?? 0,
    }
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

/** Deleting a missing key succeeds, matching the S3 API. */
export async function deleteObject(
  store: StorageStore,
  key: string
): Promise<void> {
  const { client, bucket } = r2Bucket(store)
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getObjectStream(
  store: StorageStore,
  key: string
): Promise<ReadableStream<Uint8Array> | null> {
  const { client, bucket } = r2Bucket(store)
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    )
    return result.Body?.transformToWebStream() ?? null
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}
