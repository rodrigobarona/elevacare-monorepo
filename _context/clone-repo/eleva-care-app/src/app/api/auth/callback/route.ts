/**
 * WorkOS Authentication Callback Handler (AuthKit Next.js)
 *
 * Handles the OAuth callback from WorkOS after user authentication.
 * Uses the official @workos-inc/authkit-nextjs package for automatic session management.
 *
 * Flow:
 * 1. User signs in via WorkOS AuthKit
 * 2. WorkOS redirects here with authorization code
 * 3. handleAuth() exchanges code for tokens and creates encrypted session
 * 4. Custom logic runs in onSuccess callback
 * 5. User synced to database (WorkOS as source of truth)
 * 6. Auto-create personal organization (Airbnb-style pattern)
 * 7. User redirected based on organization type:
 *    - patient_personal → /dashboard (default, fast)
 *    - expert_individual → /onboarding (guided setup)
 *
 * Sync Strategy:
 * - Always sync user data from WorkOS (single source of truth)
 * - Sync profile data (firstName/lastName) immediately
 * - Auto-create organization on first login (org-per-user model)
 * - Detect expert intent from URL state (?expert=true)
 * - Never block authentication on sync failures
 *
 * @see lib/integrations/workos/auto-organization.ts
 */
import * as Sentry from '@sentry/nextjs';
import { checkRateLimit } from '@/lib/redis/rate-limiter';
import { autoCreateUserOrganization } from '@/lib/integrations/workos/auto-organization';
import { syncWorkOSUserToDatabase } from '@/lib/integrations/workos/sync';
import { handleAuth } from '@workos-inc/authkit-nextjs';
import { type NextRequest, NextResponse } from 'next/server';

const { logger } = Sentry;

const authHandler = handleAuth({
  // Default return path - will be overridden by returnTo in state
  returnPathname: '/onboarding',
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  onSuccess: async ({ user, organizationId, authenticationMethod, state }) => {
    logger.info('WorkOS authentication successful', {
      userId: user.id,
      email: user.email,
      organizationId: organizationId || 'None',
      authenticationMethod: authenticationMethod || 'N/A',
    });

    // Sync user to database (WorkOS as source of truth)
    try {
      const syncResult = await syncWorkOSUserToDatabase({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        profilePictureUrl: user.profilePictureUrl,
      });

      if (!syncResult.success) {
        logger.error('User sync failed (non-blocking)', { error: syncResult.error });
      } else {
        logger.info('User synced successfully');
      }

      // Track authentication method if available
      if (authenticationMethod) {
        logger.info(logger.fmt`User authenticated via: ${authenticationMethod}`);
        // TODO: Track authentication method in analytics
      }

      // Parse custom state for expert intent
      let isExpertRegistration = false;

      if (state) {
        try {
          const stateData = JSON.parse(state);
          logger.debug('Custom state received', { stateData });

          // Check for expert registration flag (from ?expert=true URL param)
          if (stateData.expert === true || stateData.expert === 'true') {
            isExpertRegistration = true;
            logger.info('Expert registration detected');
          }

          // Log custom redirect path (handled by handleAuth via state.returnTo)
          if (stateData.returnTo) {
            logger.info(logger.fmt`Custom redirect path: ${stateData.returnTo}`);
          }
        } catch {
          // Invalid state JSON - ignore
        }
      }

      // Auto-create personal organization (Airbnb-style pattern)
      // - Default: patient_personal (fast, frictionless)
      // - Expert flow: expert_individual (guided onboarding)
      logger.info('Auto-creating user organization');

      const orgResult = await autoCreateUserOrganization({
        workosUserId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        orgType: isExpertRegistration ? 'expert_individual' : 'patient_personal',
      });

      if (orgResult.success) {
        logger.info('Organization created or exists', {
          isNewOrg: orgResult.isNewOrg,
          organizationId: orgResult.organizationId,
          orgType: isExpertRegistration ? 'expert_individual' : 'patient_personal',
          internalOrgId: orgResult.internalOrgId,
        });
      } else {
        logger.error('Organization creation failed', {
          error: orgResult.error,
          userId: user.id,
        });
        // This is a critical failure - user can't proceed without an organization
        // The /onboarding page will attempt to create a fallback organization
      }
    } catch (error) {
      Sentry.captureException(error);
      logger.error('Error in onSuccess callback', { error });
      // Don't throw - let authentication succeed even if database operations fail
      // This prevents auth loops if database is temporarily unavailable
    }

    // Note: Custom redirect path is handled by handleAuth via state.returnTo
    // If state.returnTo is present, handleAuth will use it; otherwise, it uses returnPathname
  },

  onError: async ({ error, request }) => {
    Sentry.captureException(error);
    logger.error('Authentication error', {
      error,
      requestUrl: request.url,
      ...(error instanceof Error && {
        message: error.message,
        stack: error.stack,
      }),
    });

    // Return error response (handleAuth will redirect to sign-in with error)
    return new Response('Authentication failed', { status: 401 });
  },
});

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = await checkRateLimit(ip, 20, 60, 'auth-callback');
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  return authHandler(request);
}
