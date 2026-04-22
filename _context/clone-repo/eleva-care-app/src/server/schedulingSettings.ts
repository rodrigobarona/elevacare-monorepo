/**
 * Scheduling Settings Service
 *
 * Manages buffer times, minimum notice periods, and time slot intervals
 * for calendar scheduling.
 */
import * as Sentry from '@sentry/nextjs';
import { db, invalidateCache } from '@/drizzle/db';
import { SchedulingSettingsTable } from '@/drizzle/schema';
import {
  DEFAULT_AFTER_EVENT_BUFFER,
  DEFAULT_BEFORE_EVENT_BUFFER,
  DEFAULT_BOOKING_WINDOW_DAYS,
  DEFAULT_MINIMUM_NOTICE,
  DEFAULT_SCHEDULING_SETTINGS,
  DEFAULT_TIME_SLOT_INTERVAL,
} from '@/lib/constants/scheduling';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

const { logger } = Sentry;

type SchedulingSettings = InferSelectModel<typeof SchedulingSettingsTable>;
type NewSchedulingSettings = InferInsertModel<typeof SchedulingSettingsTable>;

const DEFAULT_SETTINGS: Omit<NewSchedulingSettings, 'workosUserId'> = DEFAULT_SCHEDULING_SETTINGS;

/**
 * Get scheduling settings for a user
 *
 * @param userId - WorkOS user ID
 * @returns Scheduling settings for the user
 */
export async function getUserSchedulingSettings(userId: string): Promise<SchedulingSettings> {
  try {
    const settings = await db
      .select()
      .from(SchedulingSettingsTable)
      .where(eq(SchedulingSettingsTable.workosUserId, userId))
      .limit(1)
      .$withCache({ tag: `schedule-${userId}`, config: { ex: 60 } });

    if (settings.length > 0) {
      return settings[0];
    }

    logger.debug(logger.fmt`No scheduling settings found for ${userId}, creating defaults`);
    return createDefaultSchedulingSettings(userId);
  } catch (error) {
    logger.error(logger.fmt`Failed to retrieve scheduling settings for ${userId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const fallbackSettings: SchedulingSettings = {
      id: 0,
      workosUserId: userId,
      orgId: null,
      beforeEventBuffer: DEFAULT_BEFORE_EVENT_BUFFER,
      afterEventBuffer: DEFAULT_AFTER_EVENT_BUFFER,
      minimumNotice: DEFAULT_MINIMUM_NOTICE,
      timeSlotInterval: DEFAULT_TIME_SLOT_INTERVAL,
      bookingWindowDays: DEFAULT_BOOKING_WINDOW_DAYS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return fallbackSettings;
  }
}

/**
 * Create default scheduling settings for a user
 *
 * @param userId - WorkOS user ID
 * @returns Newly created scheduling settings
 */
async function createDefaultSchedulingSettings(userId: string): Promise<SchedulingSettings> {
  const newSettings: NewSchedulingSettings = {
    workosUserId: userId,
    ...DEFAULT_SETTINGS,
  };

  const [createdSettings] = await db
    .insert(SchedulingSettingsTable)
    .values(newSettings)
    .returning();

  return createdSettings;
}

/**
 * Update scheduling settings for a user
 *
 * @param userId - WorkOS user ID
 * @param updates - Settings to update
 * @returns Updated scheduling settings
 */
export async function updateSchedulingSettings(
  userId: string,
  updates: Partial<Omit<NewSchedulingSettings, 'userId'>>,
): Promise<SchedulingSettings> {
  const settings = await getUserSchedulingSettings(userId);

  const [updatedSettings] = await db
    .update(SchedulingSettingsTable)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(SchedulingSettingsTable.id, settings.id))
    .returning();

  await invalidateCache([`schedule-${userId}`]);

  return updatedSettings;
}
