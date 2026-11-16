import { getAuthApi } from "./server/auth"

export interface ProviderAccessTokenInput {
  providerId: string
  accountId: string
  userId: string
}

/**
 * Only Better Auth token API call site. `providerId` is accepted for
 * callers but is not a Better Auth account selector.
 */
export async function getProviderAccessToken(
  input: ProviderAccessTokenInput
): Promise<string> {
  const result = await getAuthApi().getAccessToken({
    body: {
      accountId: input.accountId,
      userId: input.userId,
    },
  })
  const token = result?.accessToken
  if (!token) {
    throw new Error("needs_reauthorization")
  }
  return token
}

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

/**
 * Best effort: asks Google to withdraw the grant Eleva holds for this
 * account, so disconnecting a calendar also removes Eleva from the
 * person's Google account. Revoking the access token revokes its refresh
 * token too. Microsoft has no per-app revoke for personal accounts; the
 * stored tokens are deleted instead (`releaseCalendarAccount`).
 */
export async function revokeProviderGrant(
  input: ProviderAccessTokenInput
): Promise<boolean> {
  if (input.providerId !== "google") return false
  try {
    const token = await getProviderAccessToken(input)
    const res = await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}
