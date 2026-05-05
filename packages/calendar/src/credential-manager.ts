import { eq } from "drizzle-orm"
import { withOrgContext, type Tx } from "@eleva/db/context"
import { connectedCalendars } from "@eleva/db/schema"
import {
  encryptOAuthToken,
  decryptOAuthToken,
  revokeOAuthToken,
  type OAuthProvider,
  type VaultRef,
} from "@eleva/encryption"
import type { OAuthTokens, CalendarProvider } from "./types"
import { getAdapter } from "./registry"

const PROVIDER_MAP: Record<CalendarProvider, OAuthProvider> = {
  google: "google-calendar",
  microsoft: "microsoft-graph",
}

/**
 * Store OAuth tokens in WorkOS Vault and record the connected calendar
 * in the database. The vault ref is stored in the DB; plaintext tokens
 * never touch Neon.
 */
export async function storeCalendarConnection(
  orgId: string,
  expertProfileId: string,
  provider: CalendarProvider,
  accountEmail: string,
  tokens: OAuthTokens
): Promise<string> {
  const vaultRef = await encryptOAuthToken({
    provider: PROVIDER_MAP[provider],
    userId: expertProfileId,
    orgId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  })

  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .insert(connectedCalendars)
      .values({
        orgId,
        expertProfileId,
        provider,
        accountEmail,
        credentialVaultRef: vaultRef,
        status: "connected",
        tokenExpiresAt: tokens.expiresAt,
      })
      .returning({ id: connectedCalendars.id })

    return row!.id
  })
}

/**
 * Get a valid access token for a connected calendar. Refreshes the
 * token if it's expired or about to expire (5-minute buffer).
 */
export async function getAccessToken(
  orgId: string,
  connectedCalendarId: string
): Promise<{ accessToken: string; provider: CalendarProvider }> {
  const cal = await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        provider: connectedCalendars.provider,
        credentialVaultRef: connectedCalendars.credentialVaultRef,
        tokenExpiresAt: connectedCalendars.tokenExpiresAt,
      })
      .from(connectedCalendars)
      .where(eq(connectedCalendars.id, connectedCalendarId))
      .limit(1)
    return row
  })

  if (!cal)
    throw new Error(`Connected calendar not found: ${connectedCalendarId}`)

  const vaultRef = cal.credentialVaultRef as VaultRef
  const decrypted = await decryptOAuthToken(vaultRef)
  const bufferMs = 5 * 60 * 1000

  if (
    cal.tokenExpiresAt &&
    cal.tokenExpiresAt.getTime() > Date.now() + bufferMs
  ) {
    return { accessToken: decrypted.accessToken, provider: cal.provider }
  }

  if (!decrypted.refreshToken) {
    throw new Error(`No refresh token for calendar: ${connectedCalendarId}`)
  }

  const adapter = getAdapter(cal.provider)
  const refreshed = await adapter.refreshTokens(decrypted.refreshToken)

  await revokeOAuthToken(vaultRef)
  const newVaultRef = await encryptOAuthToken({
    provider: PROVIDER_MAP[cal.provider],
    userId: connectedCalendarId,
    orgId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  })

  await withOrgContext(orgId, async (tx: Tx) => {
    await tx
      .update(connectedCalendars)
      .set({
        credentialVaultRef: newVaultRef,
        tokenExpiresAt: refreshed.expiresAt,
        status: "connected",
        updatedAt: new Date(),
      })
      .where(eq(connectedCalendars.id, connectedCalendarId))
  })

  return { accessToken: refreshed.accessToken, provider: cal.provider }
}

/**
 * Disconnect a calendar — revoke vault secrets and mark as disconnected.
 */
export async function disconnectCalendar(
  orgId: string,
  connectedCalendarId: string
): Promise<void> {
  const cal = await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({ credentialVaultRef: connectedCalendars.credentialVaultRef })
      .from(connectedCalendars)
      .where(eq(connectedCalendars.id, connectedCalendarId))
      .limit(1)
    return row
  })

  if (cal) {
    await revokeOAuthToken(cal.credentialVaultRef as VaultRef)
    await withOrgContext(orgId, async (tx: Tx) => {
      await tx
        .update(connectedCalendars)
        .set({ status: "disconnected", updatedAt: new Date() })
        .where(eq(connectedCalendars.id, connectedCalendarId))
    })
  }
}
