import { ENV_CONFIG } from '@/config/env';
import { db } from '@/drizzle/db';
import { SlotReservationsTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import {
  sendHeartbeatFailure,
  sendHeartbeatSuccess,
} from '@/lib/integrations/betterstack/heartbeat';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { lt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const { logger } = Sentry;

export const maxDuration = 60;

// Enhanced Cleanup for Slot Reservations - Removes expired and duplicate reservations
// Performs the following tasks:
// - Identifies slot reservations that have passed their expiration time
// - Removes expired reservations from the database
// - Detects and removes duplicate reservations (same event, time, guest)
// - Logs detailed information about deleted reservations
// - Provides cleanup statistics for monitoring

async function handler(request: NextRequest) {
  logger.info('Starting slot reservations cleanup (expired + duplicates)...');

  try {
    const currentTime = new Date();

    // **Step 1: Clean up expired reservations**
    const deletedExpiredReservations = await db
      .delete(SlotReservationsTable)
      .where(lt(SlotReservationsTable.expiresAt, currentTime))
      .returning();

    logger.info(logger.fmt`Cleaned up ${deletedExpiredReservations.length} expired slot reservations`, {
      count: deletedExpiredReservations.length,
      currentTime: currentTime.toISOString(),
      deletedReservations: deletedExpiredReservations.map((r) => ({
        id: r.id,
        guestEmail: r.guestEmail,
        startTime: r.startTime.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        expired: (currentTime.getTime() - r.expiresAt.getTime()) / (1000 * 60),
      })),
    });

    logger.info('Checking for duplicate reservations...');

    const duplicatesQuery = sql`
      SELECT 
        event_id,
        start_time,
        guest_email,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id ORDER BY created_at DESC) as reservation_ids
      FROM slot_reservations 
      GROUP BY event_id, start_time, guest_email 
      HAVING COUNT(*) > 1
    `;

    const duplicates = await db.execute(duplicatesQuery);

    let totalDuplicatesDeleted = 0;
    const duplicateCleanupResults = [];

    if (duplicates.rows.length > 0) {
      logger.info(
        logger.fmt`Found ${duplicates.rows.length} groups of duplicate reservations, cleaning up...`,
      );

      for (const duplicate of duplicates.rows) {
        const reservationIds = duplicate.reservation_ids as string[];
        const [keepId, ...deleteIds] = reservationIds; // Keep the most recent

        if (deleteIds.length > 0) {
          const deleteQuery = sql`
            DELETE FROM slot_reservations 
            WHERE id = ANY(${deleteIds})
          `;

          await db.execute(deleteQuery);
          totalDuplicatesDeleted += deleteIds.length;

          duplicateCleanupResults.push({
            eventId: duplicate.event_id,
            startTime: duplicate.start_time,
            guestEmail: duplicate.guest_email,
            originalCount: duplicate.duplicate_count,
            kept: keepId,
            deleted: deleteIds,
          });

          logger.info(
            logger.fmt`Cleaned up ${deleteIds.length} duplicates for slot (kept: ${keepId})`,
          );
        }
      }
    } else {
      logger.info('No duplicate reservations found');
    }

    const totalCleaned = deletedExpiredReservations.length + totalDuplicatesDeleted;

    logger.info('Cleanup completed successfully', {
      expiredDeleted: deletedExpiredReservations.length,
      duplicatesDeleted: totalDuplicatesDeleted,
      totalCleaned: totalCleaned,
      timestamp: currentTime.toISOString(),
    });

    // Send success heartbeat to BetterStack
    await sendHeartbeatSuccess({
      url: ENV_CONFIG.BETTERSTACK_CLEANUP_RESERVATIONS_HEARTBEAT,
      jobName: 'Cleanup Expired Reservations',
    });

    return NextResponse.json({
      success: true,
      expiredCleaned: deletedExpiredReservations.length,
      duplicatesCleaned: totalDuplicatesDeleted,
      totalCleaned: totalCleaned,
      duplicateGroups: duplicates.rows.length,
      duplicateDetails: duplicateCleanupResults,
      timestamp: currentTime.toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error during slot reservations cleanup', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Send failure heartbeat to BetterStack
    await sendHeartbeatFailure(
      {
        url: ENV_CONFIG.BETTERSTACK_CLEANUP_RESERVATIONS_HEARTBEAT,
        jobName: 'Cleanup Expired Reservations',
      },
      error,
    );

    return NextResponse.json(
      { error: 'Failed to cleanup reservations', details: String(error) },
      { status: 500 },
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
