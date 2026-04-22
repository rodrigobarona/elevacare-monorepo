import { hasRole } from '@/lib/auth/roles.server';
import { listSchedules } from '@/lib/integrations/qstash/client';
import { setupQStashSchedules } from '@/lib/integrations/qstash/schedules';
import type { ApiResponse } from '@/types/api';
import * as Sentry from '@sentry/nextjs';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export const maxDuration = 60;

/**
 * GET: List all current QStash schedules
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
    const schedules = await listSchedules();
    return NextResponse.json({
      success: true,
      data: { schedules },
    } as ApiResponse<{ schedules: unknown[] }>);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error listing schedules', { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to list schedules: ${errorMessage}`,
      } as ApiResponse<null>,
      { status: 500 },
    );
  }
}

/**
 * POST: Setup or reset QStash schedules
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
  try {
    const results = await setupQStashSchedules();

    // Count successes and failures
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        message: `Created ${successCount} schedules, ${failureCount} failures.`,
        results,
      },
    } as ApiResponse<{ message: string; results: unknown[] }>);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error setting up schedules', { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to setup schedules: ${errorMessage}`,
      } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
