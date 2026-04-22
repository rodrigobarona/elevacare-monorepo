import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { syncIdentityVerificationToConnect } from '@/lib/integrations/stripe';
import * as Sentry from '@sentry/nextjs';
import { timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * Timing-safe string comparison to prevent timing attacks
 * Returns false if strings have different lengths or content
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Mask email for GDPR/CCPA compliant logging
 * e.g., "user@example.com" → "us***@example.com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Internal endpoint to sync identity verification to Stripe Connect.
 * Requires INTERNAL_ADMIN_KEY for authentication via Authorization header.
 *
 * Required headers:
 * - Authorization: Bearer <INTERNAL_ADMIN_KEY>
 *
 * Required query parameters:
 * - workosUserId: The WorkOS user ID of the user
 */
export async function POST(request: Request) {
  try {
    // Get admin key from Authorization header (more secure than query params)
    const authHeader = request.headers.get('authorization');
    const adminKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Validate admin key to prevent unauthorized access using timing-safe comparison
    // Ensures env var is defined and non-empty before comparing
    const expectedKey = process.env.INTERNAL_ADMIN_KEY;
    if (!expectedKey || !adminKey || !safeCompare(adminKey, expectedKey)) {
      logger.warn('Unauthorized access attempt to /api/internal/sync-identity');
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    // Get workosUserId from query parameter
    const url = new URL(request.url);
    const workosUserId = url.searchParams.get('workosUserId');

    if (!workosUserId) {
      return NextResponse.json({ error: 'Missing workosUserId parameter' }, { status: 400 });
    }

    // Verify this is a valid user in our system
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log with masked email for GDPR/CCPA compliance
    logger.info('Syncing identity verification for user', {
      workosUserId,
      userId: user.id,
      email: maskEmail(user.email),
      hasIdentityVerification: !!user.stripeIdentityVerificationId,
      isVerified: !!user.stripeIdentityVerified,
    });

    // Call the sync function
    const result = await syncIdentityVerificationToConnect(workosUserId);

    // Note: Email included in response for admin use (this is an internal endpoint)
    return NextResponse.json({
      success: result.success,
      message: result.message,
      user: {
        email: user.email,
        connectAccountId: user.stripeConnectAccountId,
        identityVerificationId: user.stripeIdentityVerificationId,
        identityVerified: user.stripeIdentityVerified,
      },
    });
  } catch (error) {
    logger.error('Error syncing identity verification', { error: error instanceof Error ? error.message : String(error) });
    Sentry.captureException(error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
