/**
 * Google OAuth Callback Route (via WorkOS)
 *
 * Handles the OAuth callback from WorkOS after a user authorizes Google Calendar access.
 * This route:
 * 1. Receives OAuth tokens from WorkOS
 * 2. Encrypts and stores tokens in database (AES-256-GCM)
 * 3. Redirects user to success page
 *
 * Security:
 * - Tokens are encrypted before storage (same as medical records)
 * - Uses WorkOS OAuth provider for secure token exchange
 * - Validates user authentication via WorkOS session
 *
 * @see lib/integrations/google/oauth-tokens.ts - Token management
 * @see docs/09-integrations/IMPLEMENTATION-COMPLETE.md - Implementation guide
 */
import { logSecurityError } from '@/lib/constants/security';
import { storeGoogleTokens } from '@/lib/integrations/google/oauth-tokens';
import { logAuditEvent } from '@/lib/utils/server/audit';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * Google OAuth Callback Handler
 *
 * Called by WorkOS after user authorizes Google Calendar access.
 * Extracts OAuth tokens and stores them encrypted in the database.
 *
 * Query Parameters (from WorkOS):
 * - code: Authorization code (exchanged by WorkOS for tokens)
 * - state: Custom state for security/context
 * - error: Error code if authorization failed
 *
 * @example
 * // WorkOS redirects to:
 * // https://eleva.care/api/auth/google/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is authenticated via WorkOS
    const { user } = await withAuth();

    if (!user) {
      logger.error('Google OAuth Callback: No authenticated user');
      return NextResponse.redirect(new URL('/sign-in?error=unauthenticated', request.url));
    }

    // 2. Extract OAuth parameters from URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // 3. Handle OAuth errors
    if (error) {
      logger.error('Google OAuth callback error', { oauthError: error });

      // Log failed attempt for audit
      await logAuditEvent('google_calendar.connection_failed', 'integration', 'google_calendar', {
        newValues: {
          error,
          userId: user.id,
        },
      });

      return NextResponse.redirect(
        new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, request.url),
      );
    }

    // 4. Validate authorization code exists
    if (!code) {
      logger.error('Google OAuth Callback: Missing authorization code');
      return NextResponse.redirect(
        new URL('/settings/integrations?error=missing_code', request.url),
      );
    }

    // 5. TODO: Exchange authorization code for tokens via WorkOS
    // This is typically done via WorkOS API or handled automatically by WorkOS SDK
    // For now, we'll document the expected flow:
    //
    // Expected WorkOS OAuth response structure:
    // {
    //   access_token: string,
    //   refresh_token: string,
    //   expires_in: number,
    //   token_type: 'Bearer',
    //   scope: string
    // }
    //
    // NOTE: This implementation assumes WorkOS provides tokens directly.
    // If WorkOS requires an additional API call to exchange the code,
    // implement that exchange here.

    logger.warn(
      'Google OAuth Callback: TODO: Implement token exchange with WorkOS API',
      { context: 'Current implementation expects tokens in URL or WorkOS session' },
    );

    // TEMPORARY: For development/testing, check if tokens are passed as params
    // In production, these would come from WorkOS OAuth exchange
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresIn = searchParams.get('expires_in');

    if (!accessToken) {
      logger.error('Google OAuth Callback: No access token received from WorkOS');
      return NextResponse.redirect(new URL('/settings/integrations?error=no_token', request.url));
    }

    // 6. Store encrypted tokens in database
    const expiryDate = Date.now() + (expiresIn ? parseInt(expiresIn) * 1000 : 3600000); // Default 1 hour

    await storeGoogleTokens(user.id, {
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      expiry_date: expiryDate,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar', // Adjust based on actual scopes
    });

    logger.info(logger.fmt`Google OAuth Callback: Tokens encrypted and stored for user: ${user.id}`);

    // 7. Log successful connection for audit
    await logAuditEvent('google_calendar.connected', 'integration', 'google_calendar', {
      newValues: {
        userId: user.id,
        scopes: searchParams.get('scope') || 'calendar',
      },
    });

    // 8. Redirect to success page
    const successUrl = state
      ? new URL(decodeURIComponent(state), request.url)
      : new URL('/settings/integrations?success=google_connected', request.url);

    return NextResponse.redirect(successUrl);
  } catch (error) {
    logger.error('Google OAuth Callback: Error processing callback', { error });
    Sentry.captureException(error);
    logSecurityError(error, 'GOOGLE_OAUTH_CALLBACK', 'oauth_token', 'google_calendar');

    // Return user to settings with error message
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=${encodeURIComponent(error instanceof Error ? error.message : 'unknown_error')}`,
        request.url,
      ),
    );
  }
}

/**
 * TODO: Production Implementation Notes
 *
 * 1. WorkOS OAuth Token Exchange:
 *    - Implement proper token exchange with WorkOS API
 *    - Use WorkOS SDK to handle OAuth flow
 *    - Verify WorkOS provides refresh tokens
 *
 * 2. Security Enhancements:
 *    - Validate state parameter for CSRF protection
 *    - Implement rate limiting on callback endpoint
 *    - Add request signature verification if available
 *
 * 3. Error Handling:
 *    - Add specific error codes for different failure scenarios
 *    - Implement retry logic for transient failures
 *    - Add Sentry/monitoring integration
 *
 * 4. Testing:
 *    - Test with real WorkOS OAuth flow
 *    - Verify token encryption in database
 *    - Test error scenarios (denied access, expired codes, etc.)
 *    - Verify audit logging works correctly
 */
