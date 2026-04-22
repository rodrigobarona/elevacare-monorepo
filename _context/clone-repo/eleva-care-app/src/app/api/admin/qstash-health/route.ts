import { hasRole } from '@/lib/auth/roles.server';
import { isQStashAvailable, validateQStashConfig } from '@/lib/integrations/qstash/config';
import * as Sentry from '@sentry/nextjs';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * QStash health check endpoint
 * Verifies that QStash is properly configured and available
 */
export async function GET() {
  const { user } = await withAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const config = validateQStashConfig();

    if (!config.isValid) {
      return NextResponse.json(
        {
          status: 'error',
          message: config.message,
          details: 'QStash is not properly configured with required environment variables',
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    const qstashAvailable = await isQStashAvailable();

    if (!qstashAvailable) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'QStash is not available',
          details: 'Failed to connect to QStash service or configuration is invalid',
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      message: 'QStash is properly configured and available',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error checking QStash health', { error });
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to check QStash health',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
