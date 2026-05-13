import { sealData, unsealData } from "iron-session"

const UPLOAD_TOKEN_TTL_SECONDS = 3600

interface UploadTokenPayload {
  sub: string
  purpose: "blob-upload"
  iat: number
}

function getTokenPassword(): string {
  const pw = process.env.WORKOS_COOKIE_PASSWORD
  if (!pw)
    throw new Error("WORKOS_COOKIE_PASSWORD is required for upload tokens")
  return pw
}

/**
 * Mint a short-lived sealed token that authorises a client-side Vercel
 * Blob upload. The token is encrypted + authenticated via iron-session
 * using the same secret as session cookies (`WORKOS_COOKIE_PASSWORD`).
 *
 * Intended flow:
 *   1. Server action reads the session and calls `mintUploadToken(userId)`.
 *   2. Client sends the token as `Authorization: Bearer <token>` to the
 *      API upload route.
 *   3. API route calls `verifyUploadToken(token)` instead of reading
 *      session cookies (which the Blob SDK doesn't send cross-origin).
 */
export async function mintUploadToken(userId: string): Promise<string> {
  const payload: UploadTokenPayload = {
    sub: userId,
    purpose: "blob-upload",
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
    if (payload.purpose !== "blob-upload") return null
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
