'use server';

import * as Sentry from '@sentry/nextjs';
import { db, invalidateCache } from '@/drizzle/db';
import { ScheduleAvailabilitiesTable, SchedulesTable } from '@/drizzle/schema';

const { logger } = Sentry;
import { logAuditEvent } from '@/lib/utils/server/audit';
import { scheduleFormSchema } from '@/schema/schedule';
import { markStepComplete } from '@/server/actions/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { z } from 'zod';

/**
 * @fileoverview Server actions for managing expert schedules in the Eleva Care application.
 * This file handles the creation and management of expert availability schedules,
 * including time slots, timezone settings, and audit logging. It provides functionality
 * for saving and updating schedule data with proper validation and error handling.

 * Saves or updates an expert's schedule and their availability time slots.
 *
 * This function performs several operations in a transactional manner:
 * 1. Validates the incoming schedule data against the schema
 * 2. Retrieves the existing schedule for audit logging
 * 3. Upserts the schedule data (creates new or updates existing)
 * 4. Replaces all availability time slots with new ones
 * 5. Logs the changes for audit purposes
 *
 * @param unsafeData - The schedule data to be validated and saved, including:
 *   - timezone: The expert's timezone
 *   - availabilities: Array of time slots when the expert is available
 *   - Other schedule-related settings
 * @returns Object indicating success or failure of the operation
 *
 * @example
 * const result = await saveSchedule({
 *   timezone: "Europe/London",
 *   availabilities: [
 *     {
 *       dayOfWeek: "monday",
 *       startTime: "09:00",
 *       endTime: "17:00"
 *     },
 *     {
 *       dayOfWeek: "tuesday",
 *       startTime: "10:00",
 *       endTime: "18:00"
 *     }
 *   ]
 * });
 *
 * if (result?.error) {
 *   console.error("Failed to save schedule");
 * }
 */
export async function saveSchedule(unsafeData: z.infer<typeof scheduleFormSchema>) {
  return Sentry.withServerActionInstrumentation('saveSchedule', { recordResponse: true }, async () => {
    const { user } = await withAuth();
    const userId = user?.id;

    const { success, data } = scheduleFormSchema.safeParse(unsafeData);
    if (!success || userId == null) {
      return { error: true };
    }

    const { availabilities, ...scheduleData } = data;

    const oldSchedule = await db.query.SchedulesTable.findFirst({
      where: eq(SchedulesTable.workosUserId, userId),
      with: {
        availabilities: true,
      },
    });

    const [{ id: scheduleId }] = await db
      .insert(SchedulesTable)
      .values({ ...scheduleData, workosUserId: userId })
      .onConflictDoUpdate({
        target: SchedulesTable.workosUserId,
        set: scheduleData,
      })
      .returning({ id: SchedulesTable.id });

    const statements: [BatchItem<'pg'>] = [
      db
        .delete(ScheduleAvailabilitiesTable)
        .where(eq(ScheduleAvailabilitiesTable.scheduleId, scheduleId)),
    ];

    if (availabilities.length > 0) {
      statements.push(
        db.insert(ScheduleAvailabilitiesTable).values(
          availabilities.map((availability) => ({
            ...availability,
            scheduleId,
          })),
        ),
      );
    }

    await db.batch(statements);

    await logAuditEvent('PROFILE_UPDATED', 'profile', scheduleId, {
      oldValues: oldSchedule ? (oldSchedule as unknown as Record<string, unknown>) : undefined,
      newValues: { ...scheduleData, availabilities },
    });

    if (availabilities.length > 0) {
      try {
        await markStepComplete('availability');
      } catch (error) {
        logger.error('Failed to mark availability step as complete', { error });
      }
    }

    await invalidateCache([`schedule-${userId}`]);

    return { success: true };
  });
}
