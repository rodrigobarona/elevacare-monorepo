import { vaultDelete, vaultGet, vaultPut, type VaultRef } from "./vault"

/**
 * Typed helpers for the two most common vault use cases:
 * OAuth token storage (calendar, accounting adapters) and generic
 * encrypted records (transcripts, reports in S5).
 */

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

export async function encryptOAuthToken(
  input: OAuthTokenInput
): Promise<VaultRef> {
  const value = JSON.stringify({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
  })
  return vaultPut(`oauth/${input.provider}/${input.userId}`, value, {
    provider: input.provider,
    userId: input.userId,
    orgId: input.orgId,
  })
}

export interface DecryptedOAuthToken {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}

export async function decryptOAuthToken(
  ref: VaultRef
): Promise<DecryptedOAuthToken> {
  const raw = await vaultGet(ref)
  const parsed = JSON.parse(raw) as {
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

export async function revokeOAuthToken(ref: VaultRef): Promise<void> {
  await vaultDelete(ref)
}
