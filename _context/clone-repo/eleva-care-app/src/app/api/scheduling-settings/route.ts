/**
 * API Routes for Scheduling Settings
 *
 * Provides endpoints for:
 * - Getting user's scheduling settings
 * - Updating scheduling settings
 */
import { getUserSchedulingSettings, updateSchedulingSettings } from '@/server/schedulingSettings';
import { withAuth } from '@workos-inc/authkit-nextjs';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

const patchSchedulingSettingsSchema = z
  .object({
    beforeEventBuffer: z.number().min(0).optional(),
    afterEventBuffer: z.number().min(0).optional(),
    minimumNotice: z
      .number()
      .min(60)
      .max(20160)
      .refine((v) =>
        [60, 180, 360, 720, 1440, 2880, 4320, 7200, 10080, 20160].includes(v),
      )
      .optional(),
    timeSlotInterval: z
      .number()
      .min(5)
      .refine((v) => v % 5 === 0)
      .optional(),
    bookingWindowDays: z.number().min(7).max(365).optional(),
  })
  .strict();

/**
 * GET handler for fetching scheduling settings
 *
 * @returns Current scheduling settings for the authenticated user
 */
export async function GET() {
  try {
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserSchedulingSettings(userId);

    return NextResponse.json(settings);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching scheduling settings', { error });
    return NextResponse.json({ error: 'Failed to fetch scheduling settings' }, { status: 500 });
  }
}

/**
 * PATCH handler for updating scheduling settings
 *
 * @param request Contains the requested updates to settings
 * @returns Updated scheduling settings
 */
export async function PATCH(request: Request) {
  try {
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = patchSchedulingSettingsSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.flatten() },
        { status: 400 },
      );
    }
    const validUpdates = bodyResult.data;

    const updatedSettings = await updateSchedulingSettings(userId, validUpdates);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating scheduling settings', { error });
    return NextResponse.json({ error: 'Failed to update scheduling settings' }, { status: 500 });
  }
}
