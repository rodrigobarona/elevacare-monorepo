import { decryptForOrg, encryptForOrg } from "./envelope"

export type OAuthProvider =
  | "google-calendar"
  | "microsoft-graph"
  | "toconline"
  | "moloni"
  | "stripe-oauth"

export interface OAuthTokenInput {
  provider: OAuthProvider
  userId: string
  orgId: string
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}

export interface DecryptedOAuthToken {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}

export async function encryptOAuthToken(
  input: OAuthTokenInput
): Promise<string> {
  return encryptForOrg(
    input.orgId,
    JSON.stringify({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
    })
  )
}

export async function decryptOAuthToken(
  orgId: string,
  ciphertext: string
): Promise<DecryptedOAuthToken> {
  const parsed = JSON.parse(await decryptForOrg(orgId, ciphertext)) as {
    accessToken: string
    refreshToken: string | null
    expiresAt: string | null
  }
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
  }
}

export async function revokeOAuthToken(_ciphertext: string): Promise<void> {
  // Envelope ciphertext lives in the caller row; deleting that row shreds access.
}
