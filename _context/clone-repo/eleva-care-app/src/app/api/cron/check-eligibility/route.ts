/**
 * Eligibility Checker Cron Job
 *
 * Runs daily to update subscription eligibility metrics for all experts.
 * Identifies experts who qualify for annual subscription plans.
 *
 * Schedule: Daily at 2:00 AM UTC
 * Trigger: Vercel Cron or manual via QStash
 *
 * What it does:
 * 1. Fetches all active experts
 * 2. Calculates eligibility metrics
 * 3. Updates AnnualPlanEligibilityTable
 * 4. Identifies newly eligible experts (for future notification)
 */
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { updateEligibilityMetrics } from '@/server/actions/eligibility';
import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// ============================================================================
// GET Handler - Manual Trigger
// ============================================================================

export async function GET() {
  return NextResponse.json({
    message: 'Eligibility Checker Cron Job',
    schedule: 'Daily at 2:00 AM UTC',
    description: 'Updates subscription eligibility metrics for all experts',
  });
}

// ============================================================================
// POST Handler - Cron Execution (QStash-verified)
// ============================================================================

async function handler(_request: NextRequest) {
  const startTime = Date.now();

  logger.info('Starting eligibility check cron job');

  try {
    // Get all active experts (community and top)
    const experts = await db.query.UsersTable.findMany({
      where: inArray(UsersTable.role, ['expert_community', 'expert_top', 'expert_lecturer']),
      columns: {
        id: true,
        workosUserId: true,
        role: true,
      },
    });

    logger.info(logger.fmt`Found ${experts.length} experts to process`);

    let successCount = 0;
    let failCount = 0;

    for (const expert of experts) {
      try {
        const success = await updateEligibilityMetrics(expert.workosUserId);
        if (success) {
          successCount++;
          // TODO: Check if newly eligible and add to notification queue
        } else {
          failCount++;
        }
      } catch (error) {
        logger.error(logger.fmt`Error processing expert ${expert.workosUserId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        Sentry.captureException(error, { extra: { expertId: expert.workosUserId } });
        failCount++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Eligibility check complete', {
      total: experts.length,
      success: successCount,
      failed: failCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      stats: {
        total: experts.length,
        processed: successCount,
        failed: failCount,
        durationMs: duration,
      },
    });
  } catch (error) {
    logger.error('Eligibility check cron failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
