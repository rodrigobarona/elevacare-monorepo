import * as Sentry from '@sentry/nextjs';
import { ENV_CONFIG } from '@/config/env';

const { logger } = Sentry;
import { createHmacSha256 } from '@/lib/utils/crypto';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET endpoint: Returns secure subscriber data with HMAC hash
 * This endpoint generates a secure hash for Novu authentication
 */
export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user from WorkOS AuthKit
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the authenticated userId as subscriberId
    const subscriberId = userId;

    // Generate HMAC hash for secure authentication using runtime-aware crypto
    let subscriberHash = '';
    if (ENV_CONFIG.NOVU_SECRET_KEY) {
      subscriberHash = createHmacSha256(ENV_CONFIG.NOVU_SECRET_KEY, subscriberId);
    }

    const secureData = {
      subscriberId,
      subscriberHash,
      applicationIdentifier: ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER,
    };

    return NextResponse.json(secureData);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error generating subscriber hash', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
