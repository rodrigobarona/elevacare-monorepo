import { qstash } from '@/config/qstash';
import { hasRole } from '@/lib/auth/roles.server';
import { isQStashAvailable, qstashClient } from '@/lib/integrations/qstash/client';
import { getQStashConfigMessage, validateQStashConfig } from '@/lib/integrations/qstash/config';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export const maxDuration = 60;

interface QStashStatus {
  operational: boolean;
  signingKeys: {
    current: boolean;
    next: boolean;
  };
  token: boolean;
  schedules: {
    count: number;
    details: Array<{
      id: string;
      destination: string;
      schedule: string;
    }>;
  };
  connectivity: boolean;
  baseUrl: string;
}

/**
 * GET - Verify QStash configuration
 * This endpoint checks if QStash is properly configured
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
  // Use our validation helper to check configuration
  const config = validateQStashConfig();

  try {
    // Check for signing keys manually to avoid breaking changes
    const hasCurrentSigningKey = !!process.env.QSTASH_CURRENT_SIGNING_KEY;
    const hasNextSigningKey = !!process.env.QSTASH_NEXT_SIGNING_KEY;
    const hasToken = !!process.env.QSTASH_TOKEN;

    const status: QStashStatus = {
      operational: false,
      signingKeys: {
        current: hasCurrentSigningKey,
        next: hasNextSigningKey,
      },
      token: hasToken,
      schedules: {
        count: 0,
        details: [],
      },
      connectivity: false,
      baseUrl: qstash.baseUrl || 'unknown',
    };

    // If configuration is invalid, return that info immediately
    if (!config.isValid) {
      return NextResponse.json(
        {
          message: 'QStash configuration is incomplete',
          status,
          help: getQStashConfigMessage(),
        },
        { status: 428 }, // Precondition Required
      );
    }

    // Test connectivity by listing schedules
    if (isQStashAvailable() && qstashClient) {
      try {
        const schedules = await qstashClient.schedules.list();
        status.connectivity = true;
        status.schedules.count = schedules.length;

        // Get details of each schedule - safely extract properties to avoid TypeScript errors
        status.schedules.details = schedules.map((schedule) => {
          // Convert to unknown first then to an object with any properties
          const s = schedule as unknown as Record<string, unknown>;
          return {
            id:
              typeof s.scheduleId === 'string'
                ? s.scheduleId
                : typeof s.id === 'string'
                  ? s.id
                  : 'unknown-id',
            destination:
              typeof s.url === 'string'
                ? s.url
                : typeof s.destination === 'string'
                  ? s.destination
                  : 'unknown-dest',
            schedule:
              typeof s.cron === 'string'
                ? s.cron
                : typeof s.interval === 'string'
                  ? s.interval
                  : 'unknown-schedule',
          };
        });

        // Overall status is operational if we have connectivity and at least one schedule
        status.operational = status.connectivity && status.schedules.count > 0;
      } catch (error) {
        Sentry.captureException(error);
        logger.error('Error testing QStash connectivity', { error });
        status.connectivity = false;
        status.operational = false;
      }
    } else {
      status.connectivity = false;
      status.operational = false;
    }

    // Return the status
    return NextResponse.json({
      message: status.operational
        ? 'QStash is properly configured'
        : 'QStash configuration issues detected',
      status,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error verifying QStash setup', { error });
    return NextResponse.json(
      { error: 'Failed to verify QStash setup', details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * POST - Test QStash messaging
 * Sends a test message to the QStash API to verify functionality
 */
export async function POST() {
  const { user } = await withAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Check if QStash is available
  if (!isQStashAvailable() || !qstashClient) {
    return NextResponse.json(
      {
        error: 'QStash client is not initialized',
        help: getQStashConfigMessage(),
      },
      { status: 428 },
    );
  }

  try {
    // Get the base URL from our config
    const baseUrl = qstash.baseUrl;

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Missing base URL in QStash configuration' },
        { status: 500 },
      );
    }

    // Construct the destination URL for a simple GET endpoint
    const destinationUrl = `${baseUrl}/api/healthcheck`;

    // Send a test message
    const response = await qstashClient.publishJSON({
      url: destinationUrl,
      body: { test: true, timestamp: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      message: 'Test message sent to QStash',
      messageId: response.messageId,
      destination: destinationUrl,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error sending test QStash message', { error });
    return NextResponse.json(
      { error: 'Failed to send test QStash message', details: String(error) },
      { status: 500 },
    );
  }
}
