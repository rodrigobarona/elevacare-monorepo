/**
 * Google OAuth Token Management with WorkOS Vault
 *
 * Manages Google OAuth tokens obtained via WorkOS OAuth provider.
 * Stores tokens ENCRYPTED in database using WorkOS Vault.
 *
 * Architecture:
 * - WorkOS handles OAuth flow with Google
 * - Tokens encrypted with WorkOS Vault (org-scoped keys)
 * - Stored in database (users.vault_google_* columns)
 * - Automatic refresh using Google Auth Library
 * - HIPAA/GDPR compliant with built-in audit logging
 *
 * Security:
 * - All tokens encrypted at rest using WorkOS Vault
 * - Org-scoped encryption keys (one key per organization)
 * - Built-in audit trail for compliance
 * - Automatic key rotation by WorkOS
 *
 * @module GoogleOAuthTokens
 */

'use server';

import { db } from '@/drizzle/db';
import { UserOrgMembershipsTable, UsersTable } from '@/drizzle/schema';
import { vaultDecrypt, vaultEncrypt } from '@/lib/utils/encryption-vault';
import { eq } from 'drizzle-orm';
import { google } from 'googleapis';

/**
 * Google OAuth Token Management with WorkOS Vault
 *
 * Manages Google OAuth tokens obtained via WorkOS OAuth provider.
 * Stores tokens ENCRYPTED in database using WorkOS Vault.
 *
 * Architecture:
 * - WorkOS handles OAuth flow with Google
 * - Tokens encrypted with WorkOS Vault (org-scoped keys)
 * - Stored in database (users.vault_google_* columns)
 * - Automatic refresh using Google Auth Library
 * - HIPAA/GDPR compliant with built-in audit logging
 *
 * Security:
 * - All tokens encrypted at rest using WorkOS Vault
 * - Org-scoped encryption keys (one key per organization)
 * - Built-in audit trail for compliance
 * - Automatic key rotation by WorkOS
 *
 * @module GoogleOAuthTokens
 */

/**
 * Google OAuth Token Management with WorkOS Vault
 *
 * Manages Google OAuth tokens obtained via WorkOS OAuth provider.
 * Stores tokens ENCRYPTED in database using WorkOS Vault.
 *
 * Architecture:
 * - WorkOS handles OAuth flow with Google
 * - Tokens encrypted with WorkOS Vault (org-scoped keys)
 * - Stored in database (users.vault_google_* columns)
 * - Automatic refresh using Google Auth Library
 * - HIPAA/GDPR compliant with built-in audit logging
 *
 * Security:
 * - All tokens encrypted at rest using WorkOS Vault
 * - Org-scoped encryption keys (one key per organization)
 * - Built-in audit trail for compliance
 * - Automatic key rotation by WorkOS
 *
 * @module GoogleOAuthTokens
 */

/**
 * Google OAuth Token Management with WorkOS Vault
 *
 * Manages Google OAuth tokens obtained via WorkOS OAuth provider.
 * Stores tokens ENCRYPTED in database using WorkOS Vault.
 *
 * Architecture:
 * - WorkOS handles OAuth flow with Google
 * - Tokens encrypted with WorkOS Vault (org-scoped keys)
 * - Stored in database (users.vault_google_* columns)
 * - Automatic refresh using Google Auth Library
 * - HIPAA/GDPR compliant with built-in audit logging
 *
 * Security:
 * - All tokens encrypted at rest using WorkOS Vault
 * - Org-scoped encryption keys (one key per organization)
 * - Built-in audit trail for compliance
 * - Automatic key rotation by WorkOS
 *
 * @module GoogleOAuthTokens
 */

/**
 * Google OAuth Token Management with WorkOS Vault
 *
 * Manages Google OAuth tokens obtained via WorkOS OAuth provider.
 * Stores tokens ENCRYPTED in database using WorkOS Vault.
 *
 * Architecture:
 * - WorkOS handles OAuth flow with Google
 * - Tokens encrypted with WorkOS Vault (org-scoped keys)
 * - Stored in database (users.vault_google_* columns)
 * - Automatic refresh using Google Auth Library
 * - HIPAA/GDPR compliant with built-in audit logging
 *
 * Security:
 * - All tokens encrypted at rest using WorkOS Vault
 * - Org-scoped encryption keys (one key per organization)
 * - Built-in audit trail for compliance
 * - Automatic key rotation by WorkOS
 *
 * @module GoogleOAuthTokens
 */

/**
 * Google OAuth Token Management with WorkOS Vault
 *
 * Manages Google OAuth tokens obtained via WorkOS OAuth provider.
 * Stores tokens ENCRYPTED in database using WorkOS Vault.
 *
 * Architecture:
 * - WorkOS handles OAuth flow with Google
 * - Tokens encrypted with WorkOS Vault (org-scoped keys)
 * - Stored in database (users.vault_google_* columns)
 * - Automatic refresh using Google Auth Library
 * - HIPAA/GDPR compliant with built-in audit logging
 *
 * Security:
 * - All tokens encrypted at rest using WorkOS Vault
 * - Org-scoped encryption keys (one key per organization)
 * - Built-in audit trail for compliance
 * - Automatic key rotation by WorkOS
 *
 * @module GoogleOAuthTokens
 */

/**
 * Google OAuth token structure from WorkOS/Google OAuth flow
 */
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string | null;
  expiry_date: number; // Unix timestamp in milliseconds
  token_type: 'Bearer';
  scope: string; // Space-separated list of granted scopes
}

/**
 * Store Google OAuth tokens for a user (ENCRYPTED with WorkOS Vault)
 *
 * Called after successful WorkOS OAuth callback with Google tokens.
 * Tokens are encrypted using WorkOS Vault with org-scoped keys.
 *
 * @param workosUserId - WorkOS user ID
 * @param tokens - OAuth tokens from WorkOS/Google
 *
 * @example
 * ```ts
 * // In OAuth callback route
 * await storeGoogleTokens(userId, {
 *   access_token: 'ya29...',
 *   refresh_token: '1//...',
 *   expiry_date: Date.now() + 3600000,
 *   token_type: 'Bearer',
 *   scope: 'https://www.googleapis.com/auth/calendar'
 * });
 * ```
 */
export async function storeGoogleTokens(
  workosUserId: string,
  tokens: GoogleOAuthTokens,
): Promise<void> {
  // Get org ID from memberships
  const membership = await db.query.UserOrgMembershipsTable.findFirst({
    where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
    columns: { orgId: true },
  });

  if (!membership?.orgId) {
    throw new Error('User organization not found. Cannot encrypt tokens.');
  }

  // Encrypt tokens with Vault
  const accessTokenEncrypted = await vaultEncrypt(membership.orgId, tokens.access_token, {
    userId: workosUserId,
    dataType: 'google_access_token',
  });

  let refreshTokenEncrypted: string | null = null;
  if (tokens.refresh_token) {
    const encrypted = await vaultEncrypt(membership.orgId, tokens.refresh_token, {
      userId: workosUserId,
      dataType: 'google_refresh_token',
    });
    refreshTokenEncrypted = encrypted.ciphertext;
  }

  // Store in database
  await db
    .update(UsersTable)
    .set({
      vaultGoogleAccessToken: accessTokenEncrypted.ciphertext,
      vaultGoogleRefreshToken: refreshTokenEncrypted,
      googleTokenEncryptionMethod: 'vault',
      googleTokenExpiry: new Date(tokens.expiry_date),
      googleScopes: tokens.scope, // Store actual granted scopes
      googleCalendarConnected: true,
      googleCalendarConnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(UsersTable.workosUserId, workosUserId));

  console.log('✅ Google OAuth tokens encrypted with Vault for user:', workosUserId);
}

/**
 * Get stored Google OAuth tokens (DECRYPTED from WorkOS Vault)
 *
 * Retrieves and decrypts tokens from database using WorkOS Vault.
 *
 * @param workosUserId - WorkOS user ID
 * @returns Decrypted tokens or null if not connected
 */
export async function getStoredGoogleTokens(
  workosUserId: string,
): Promise<GoogleOAuthTokens | null> {
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, workosUserId),
    columns: {
      vaultGoogleAccessToken: true,
      vaultGoogleRefreshToken: true,
      googleTokenExpiry: true,
      googleScopes: true,
    },
  });

  if (!user?.vaultGoogleAccessToken || !user.googleTokenExpiry) {
    return null;
  }

  // Get org from memberships
  const membership = await db.query.UserOrgMembershipsTable.findFirst({
    where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
    columns: { orgId: true },
  });

  if (!membership?.orgId) {
    throw new Error('User organization not found. Cannot decrypt tokens.');
  }

  // Decrypt tokens from Vault
  const accessToken = await vaultDecrypt(membership.orgId, user.vaultGoogleAccessToken, {
    userId: workosUserId,
    dataType: 'google_access_token',
  });

  let refreshToken: string | null = null;
  if (user.vaultGoogleRefreshToken) {
    refreshToken = await vaultDecrypt(membership.orgId, user.vaultGoogleRefreshToken, {
      userId: workosUserId,
      dataType: 'google_refresh_token',
    });
  }

  console.log('[Google OAuth] ✅ Decrypted tokens with Vault');

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: user.googleTokenExpiry.getTime(),
    token_type: 'Bearer',
    // Return actual granted scopes from database, or fallback to default calendar scopes
    // Note: openid, userinfo.email, userinfo.profile are handled by WorkOS OAuth provider
    // Required scopes:
    // - calendar.events: Create/edit/delete events
    // - calendar.calendarlist.readonly: List calendars (let expert choose which to sync)
    scope:
      user.googleScopes ||
      'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  };
}

/**
 * Get an authenticated Google OAuth2 client with automatic token refresh
 *
 * This is the main function to use for Google API access. It:
 * 1. Retrieves stored tokens from database
 * 2. Configures OAuth2 client with refresh handler
 * 3. Automatically refreshes expired tokens
 * 4. Stores new tokens back to database
 *
 * @param workosUserId - WorkOS user ID
 * @returns Configured Google OAuth2 client
 * @throws Error if user hasn't connected Google Calendar
 *
 * @example
 * ```ts
 * const auth = await getGoogleOAuthClient(userId);
 * const calendar = google.calendar({ version: 'v3', auth });
 * const events = await calendar.events.list({
 *   calendarId: 'primary',
 *   timeMin: new Date().toISOString(),
 *   maxResults: 10,
 * });
 * ```
 */
export async function getGoogleOAuthClient(workosUserId: string) {
  const tokens = await getStoredGoogleTokens(workosUserId);

  if (!tokens) {
    throw new Error('Google Calendar not connected. User must authorize via WorkOS OAuth.');
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  });

  // Set initial credentials
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    token_type: tokens.token_type,
    scope: tokens.scope,
  });

  // 🔄 Setup automatic token refresh handler
  // This event fires when tokens are refreshed by Google
  oauth2Client.on('tokens', async (newTokens) => {
    console.log('🔄 Google tokens refreshed for user:', workosUserId);

    // Get org ID for encryption
    const membership = await db.query.UserOrgMembershipsTable.findFirst({
      where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
      columns: { orgId: true },
    });

    if (!membership?.orgId) {
      console.error('Cannot encrypt refreshed tokens: org ID not found');
      return;
    }

    // Encrypt new tokens with Vault
    const updateData: {
      vaultGoogleAccessToken?: string;
      vaultGoogleRefreshToken?: string;
      googleTokenExpiry?: Date;
      googleScopes?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (newTokens.access_token) {
      const encrypted = await vaultEncrypt(membership.orgId, newTokens.access_token, {
        userId: workosUserId,
        dataType: 'google_access_token',
      });
      updateData.vaultGoogleAccessToken = encrypted.ciphertext;
    }

    // Only update refresh token if a new one is provided
    // (Google only sends refresh token on first authorization)
    if (newTokens.refresh_token) {
      const encrypted = await vaultEncrypt(membership.orgId, newTokens.refresh_token, {
        userId: workosUserId,
        dataType: 'google_refresh_token',
      });
      updateData.vaultGoogleRefreshToken = encrypted.ciphertext;
    }

    if (newTokens.expiry_date) {
      updateData.googleTokenExpiry = new Date(newTokens.expiry_date);
    }

    // Update scopes if provided (usually same as original, but could change)
    if (newTokens.scope) {
      updateData.googleScopes = newTokens.scope;
    }

    // Store encrypted tokens in database
    await db.update(UsersTable).set(updateData).where(eq(UsersTable.workosUserId, workosUserId));

    console.log('✅ Refreshed tokens encrypted with Vault and stored');
  });

  return oauth2Client;
}

/**
 * Check if user has Google Calendar connected
 *
 * @param workosUserId - WorkOS user ID
 * @returns true if connected and tokens exist
 */
export async function hasGoogleCalendarConnected(workosUserId: string): Promise<boolean> {
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, workosUserId),
    columns: {
      googleCalendarConnected: true,
      vaultGoogleAccessToken: true,
    },
  });

  return !!(user?.googleCalendarConnected && user?.vaultGoogleAccessToken);
}

/**
 * Disconnect Google Calendar for a user
 *
 * Removes stored tokens and revokes access with Google.
 *
 * @param workosUserId - WorkOS user ID
 */
export async function disconnectGoogleCalendar(workosUserId: string): Promise<void> {
  try {
    // Get current tokens to revoke
    const tokens = await getStoredGoogleTokens(workosUserId);

    if (tokens?.access_token) {
      // Revoke token with Google
      const oauth2Client = new google.auth.OAuth2();
      await oauth2Client.revokeToken(tokens.access_token);
      console.log('✅ Token revoked with Google');
    }
  } catch (error) {
    console.error('Failed to revoke Google token:', error);
    // Continue with local cleanup even if revoke fails
  }

  // Clear tokens from database
  await db
    .update(UsersTable)
    .set({
      vaultGoogleAccessToken: null,
      vaultGoogleRefreshToken: null,
      googleTokenExpiry: null,
      googleScopes: null,
      googleCalendarConnected: false,
      googleTokenEncryptionMethod: null,
      updatedAt: new Date(),
    })
    .where(eq(UsersTable.workosUserId, workosUserId));

  console.log('✅ Google Calendar disconnected for user:', workosUserId);
}
