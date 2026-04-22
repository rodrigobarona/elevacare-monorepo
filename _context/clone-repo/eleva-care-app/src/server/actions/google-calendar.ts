/**
 * Google Calendar Integration Server Actions
 *
 * Provides server actions for connecting, disconnecting, and managing Google Calendar integration.
 * Uses WorkOS OAuth for secure token exchange and database-backed encrypted storage.
 *
 * Security:
 * - All tokens encrypted with AES-256-GCM (same as medical records)
 * - OAuth flow handled securely via WorkOS
 * - Audit logging for all connection/disconnection events
 *
 * @see lib/integrations/google/oauth-tokens.ts - Token management
 * @see app/api/auth/google/callback/route.ts - OAuth callback handler
 */

'use server';

import * as Sentry from '@sentry/nextjs';
import {
  disconnectGoogleCalendar,
  hasGoogleCalendarConnected,
} from '@/lib/integrations/google/oauth-tokens';
import { logAuditEvent } from '@/lib/utils/server/audit';
import { withAuth } from '@workos-inc/authkit-nextjs';

const { logger } = Sentry;

/**
 * Google Calendar Integration Server Actions
 *
 * Provides server actions for connecting, disconnecting, and managing Google Calendar integration.
 * Uses WorkOS OAuth for secure token exchange and database-backed encrypted storage.
 *
 * Security:
 * - All tokens encrypted with AES-256-GCM (same as medical records)
 * - OAuth flow handled securely via WorkOS
 * - Audit logging for all connection/disconnection events
 *
 * @see lib/integrations/google/oauth-tokens.ts - Token management
 * @see app/api/auth/google/callback/route.ts - OAuth callback handler
 */

/**
 * Google Calendar Integration Server Actions
 *
 * Provides server actions for connecting, disconnecting, and managing Google Calendar integration.
 * Uses WorkOS OAuth for secure token exchange and database-backed encrypted storage.
 *
 * Security:
 * - All tokens encrypted with AES-256-GCM (same as medical records)
 * - OAuth flow handled securely via WorkOS
 * - Audit logging for all connection/disconnection events
 *
 * @see lib/integrations/google/oauth-tokens.ts - Token management
 * @see app/api/auth/google/callback/route.ts - OAuth callback handler
 */

/**
 * Initiates Google Calendar OAuth connection flow
 *
 * Generates a WorkOS authorization URL that the user should be redirected to.
 * WorkOS handles the OAuth flow with Google and returns to our callback route.
 *
 * Flow:
 * 1. User clicks "Connect Calendar" button
 * 2. This action generates WorkOS OAuth URL
 * 3. User is redirected to Google for authorization
 * 4. Google redirects to WorkOS
 * 5. WorkOS redirects to our callback route with tokens
 * 6. Callback route encrypts and stores tokens
 *
 * @returns Object with authorization URL or error
 *
 * @example
 * ```tsx
 * // In a client component:
 * const result = await connectGoogleCalendar();
 * if (result.success && result.authorizationUrl) {
 *   window.location.href = result.authorizationUrl;
 * }
 * ```
 */
export async function connectGoogleCalendar(): Promise<
  { success: true; authorizationUrl: string } | { success: false; error: string; message: string }
> {
  return Sentry.withServerActionInstrumentation('connectGoogleCalendar', { recordResponse: true }, async () => {
  try {
    // 1. Verify user authentication
    const { user } = await withAuth();

    if (!user) {
      return {
        success: false as const,
        error: 'unauthenticated',
        message: 'You must be signed in to connect Google Calendar',
      };
    }

    // 2. Check if already connected
    const isConnected = await hasGoogleCalendarConnected(user.id);

    if (isConnected) {
      return {
        success: false as const,
        error: 'already_connected',
        message: 'Google Calendar is already connected. Disconnect first to reconnect.',
      };
    }

    // 3. TODO: Generate WorkOS OAuth authorization URL
    //
    // Expected implementation using WorkOS SDK:
    //
    // import { WorkOS } from '@workos-inc/node';
    // const workos = new WorkOS(process.env.WORKOS_API_KEY);
    //
    // const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    //   provider: 'GoogleOAuth',
    //   redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    //   state: encodeURIComponent('/settings/integrations?tab=calendar'),
    //   scopes: [
    //     'https://www.googleapis.com/auth/calendar',
    //     'https://www.googleapis.com/auth/calendar.events'
    //   ],
    // });

    // TEMPORARY: Return placeholder URL for development
    // In production, this would be the actual WorkOS authorization URL
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;
    const stateParam = encodeURIComponent('/settings/integrations?tab=calendar');

    logger.warn(
      '[Connect Google Calendar] TODO: Implement WorkOS OAuth URL generation',
      { note: 'Using placeholder URL for development' },
    );

    // Placeholder URL - replace with actual WorkOS OAuth URL
    const authorizationUrl = `https://api.workos.com/user_management/authorize?provider=GoogleOAuth&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${stateParam}&response_type=code&client_id=${process.env.WORKOS_CLIENT_ID}`;

    // 4. Log connection initiation for audit
    await logAuditEvent('google_calendar.connection_initiated', 'integration', 'google_calendar', {
      newValues: {
        userId: user.id,
      },
    });

    logger.info('[Connect Google Calendar] Authorization URL generated for user', { userId: user.id });

    return { success: true as const, authorizationUrl };
  } catch (error) {
    logger.error('[Connect Google Calendar] Error initiating connection', { error });

    return {
      success: false as const,
      error: 'internal_error',
      message:
        error instanceof Error ? error.message : 'Failed to initiate Google Calendar connection',
    };
  }
  });
}

/**
 * Disconnects Google Calendar integration
 *
 * Revokes OAuth tokens and removes them from the database.
 * Also attempts to revoke the token with Google to fully disconnect.
 *
 * @returns Success status and message
 *
 * @example
 * ```tsx
 * const result = await disconnectGoogleCalendarAction();
 * if (result.success) {
 *   toast.success('Google Calendar disconnected');
 * }
 * ```
 */
export async function disconnectGoogleCalendarAction(): Promise<
  { success: true; message: string } | { success: false; error: string; message: string }
> {
  return Sentry.withServerActionInstrumentation('disconnectGoogleCalendarAction', { recordResponse: true }, async (): Promise<
    { success: true; message: string } | { success: false; error: string; message: string }
  > => {
    try {
      const { user } = await withAuth();

      if (!user) {
        return { success: false as const, error: 'unauthenticated', message: 'You must be signed in to disconnect Google Calendar' };
      }

      const isConnected = await hasGoogleCalendarConnected(user.id);

      if (!isConnected) {
        return { success: false as const, error: 'not_connected', message: 'Google Calendar is not connected' };
      }

      await disconnectGoogleCalendar(user.id);

      await logAuditEvent('google_calendar.disconnected', 'integration', 'google_calendar', {
        newValues: {
          userId: user.id,
        },
      });

      logger.info('[Disconnect Google Calendar] Calendar disconnected for user', { userId: user.id });

      return { success: true as const, message: 'Google Calendar disconnected successfully' };
    } catch (error) {
      logger.error('[Disconnect Google Calendar] Error disconnecting', { error });

      return {
        success: false as const,
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Failed to disconnect Google Calendar',
      };
    }
  });
}

/**
 * Checks if user has Google Calendar connected
 *
 * @returns Connection status
 */
export async function checkGoogleCalendarConnection(): Promise<
  { success: true; isConnected: boolean; connectedAt?: Date } | { success: false; error: string }
> {
  return Sentry.withServerActionInstrumentation('checkGoogleCalendarConnection', { recordResponse: true }, async (): Promise<
    { success: true; isConnected: boolean; connectedAt?: Date } | { success: false; error: string }
  > => {
  try {
    const { user } = await withAuth();

    if (!user) {
      return { success: false as const, error: 'unauthenticated' };
    }

    const isConnected = await hasGoogleCalendarConnected(user.id);

    // TODO: Fetch connectedAt timestamp from database
    // This would require updating the hasGoogleCalendarConnected function
    // to return more details or creating a new function

    return { success: true as const, isConnected };
  } catch (error) {
    logger.error('[Check Google Calendar Connection] Error', { error });

    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to check connection status',
    };
  }
  });
}

/**
 * TODO: Production Implementation Notes
 *
 * 1. WorkOS OAuth Integration:
 *    - Import and configure WorkOS SDK
 *    - Implement proper authorization URL generation
 *    - Add support for custom scopes (calendar.readonly, calendar.events)
 *    - Handle organization-level OAuth if needed
 *
 * 2. State Management:
 *    - Implement proper state parameter encoding/decoding
 *    - Add CSRF token validation
 *    - Support custom return URLs
 *
 * 3. Error Handling:
 *    - Add specific error codes for different failure scenarios
 *    - Implement retry logic for transient failures
 *    - Add rate limiting to prevent abuse
 *
 * 4. Audit & Monitoring:
 *    - Add more detailed audit events
 *    - Track OAuth errors and failures
 *    - Monitor connection/disconnection rates
 *
 * 5. Testing:
 *    - Test with real WorkOS OAuth flow
 *    - Test disconnection and reconnection
 *    - Test error scenarios
 *    - Verify audit logging
 */
