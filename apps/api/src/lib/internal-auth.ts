import { createHash, timingSafeEqual } from "node:crypto"
import { Receiver } from "@upstash/qstash"

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

/**
 * Constant-time `Authorization: Bearer <secret>` check. Both sides are
 * hashed first so differing lengths do not short-circuit the compare.
 */
export function bearerMatches(
  header: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!header || !secret) return false
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}

/**
 * Verifies the `upstash-signature` JWT against the current/next QStash
 * signing keys. Returns `false` when the header or keys are missing.
 * Reads a clone so the handler can still consume the body.
 */
export async function verifyQstashSignature(
  request: Request
): Promise<boolean> {
  const signature = request.headers.get("upstash-signature")
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!signature || !currentSigningKey || !nextSigningKey) return false
  const receiver = new Receiver({ currentSigningKey, nextSigningKey })
  try {
    return await receiver.verify({
      signature,
      body: await request.clone().text(),
      url: request.url,
    })
  } catch {
    return false
  }
}

/**
 * Internal workflow callers authenticate with either a valid QStash
 * signature or the `WORKFLOWS_DRAIN_SECRET` bearer (operator/CI runs).
 */
export async function isAuthorizedWorkflowCall(
  request: Request
): Promise<boolean> {
  if (
    bearerMatches(
      request.headers.get("authorization"),
      process.env.WORKFLOWS_DRAIN_SECRET
    )
  ) {
    return true
  }
  return verifyQstashSignature(request)
}
