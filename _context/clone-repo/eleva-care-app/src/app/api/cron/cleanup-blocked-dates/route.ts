import { db } from '@/drizzle/db';
import { BlockedDatesTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { formatInTimeZone } from 'date-fns-tz';
import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// Cleanup Blocked Dates - Removes expired blocked dates from expert calendars
// Performs the following tasks:
// - Fetches all blocked dates from the database
// - Checks if dates are expired in their own timezone
// - Deletes expired dates while maintaining timezone integrity
// - Provides detailed logging and cleanup statistics

export const maxDuration = 60;

/**
 * Handle GET requests (not supported)
 */
export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint only accepts POST requests from QStash' },
    { status: 405 },
  );
}

/**
 * Handle POST requests from QStash
 * This endpoint cleans up expired blocked dates, respecting each date's timezone
 */
async function handler() {
  try {
    // First, get all blocked dates
    const blockedDates = await db.select().from(BlockedDatesTable);
    const expiredDateIds: number[] = [];

    // For each blocked date, check if it's expired in its own timezone
    for (const blockedDate of blockedDates) {
      // Get current date in the blocked date's timezone
      const nowInTimezone = formatInTimeZone(new Date(), blockedDate.timezone, 'yyyy-MM-dd');

      // If the blocked date is before today in its timezone, mark it for deletion
      if (blockedDate.date < nowInTimezone) {
        expiredDateIds.push(blockedDate.id);
      }
    }

    // If no expired dates found, return early
    if (expiredDateIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired blocked dates found',
        deletedDates: [],
      });
    }

    // Delete all expired dates
    const result = await db
      .delete(BlockedDatesTable)
      .where(inArray(BlockedDatesTable.id, expiredDateIds))
      .returning();

    logger.info(logger.fmt`Cleaned up ${result.length} expired blocked dates`);
    logger.info('Deleted dates', {
      dates: result.map((d) => ({
        id: d.id,
        date: d.date,
        timezone: d.timezone,
        localTime: formatInTimeZone(new Date(), d.timezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${result.length} expired blocked dates`,
      deletedDates: result,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error cleaning up blocked dates', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'Failed to clean up blocked dates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Export the handler with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
