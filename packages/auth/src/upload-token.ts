import { hkdfSync } from "node:crypto"
import { sealData, unsealData } from "iron-session"

const UPLOAD_TOKEN_TTL_SECONDS = 3600
const UPLOAD_TOKEN_INFO = "eleva:storage-upload-token:v1"

interface UploadTokenPayload {
  sub: string
  purpose: "storage-upload"
  iat: number
}

function getTokenPassword(): string {
  const root = process.env.BETTER_AUTH_SECRET
  if (!root) throw new Error("BETTER_AUTH_SECRET is required for upload tokens")
  return Buffer.from(
    hkdfSync("sha256", root, "", UPLOAD_TOKEN_INFO, 32)
  ).toString("base64url")
}

/**
 * Mint a short-lived sealed token that authorises a direct browser
 * upload. The token is encrypted + authenticated via iron-session
 * using an HKDF-derived key from `BETTER_AUTH_SECRET`.
 *
 * Intended flow:
 *   1. Server action reads the session and calls `mintUploadToken(userId)`.
 *   2. Client sends the token as `Authorization: Bearer <token>` to the
 *      API upload route.
 *   3. API route calls `verifyUploadToken(token)` instead of reading
 *      session cookies (not sent to the API from other origins).
 */
export async function mintUploadToken(userId: string): Promise<string> {
  const payload: UploadTokenPayload = {
    sub: userId,
    purpose: "storage-upload",
    iat: Math.floor(Date.now() / 1000),
  }
  return sealData(payload, {
    password: getTokenPassword(),
    ttl: UPLOAD_TOKEN_TTL_SECONDS,
  })
}

/**
 * Verify and decode a sealed upload token. Returns the userId on
 * success or `null` if the token is invalid, expired, or tampered.
 */
export async function verifyUploadToken(
  token: string
): Promise<{ userId: string } | null> {
  const password = getTokenPassword()
  try {
    const payload = await unsealData<UploadTokenPayload>(token, {
      password,
      ttl: UPLOAD_TOKEN_TTL_SECONDS,
    })
    if (payload.purpose !== "storage-upload") return null
    if (!payload.sub) return null
    return { userId: payload.sub }
  } catch (err) {
    console.warn(
      "[upload-token] unseal failed:",
      err instanceof Error ? err.message : err
    )
    return null
  }
}
