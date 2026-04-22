import type { DAYS_OF_WEEK_IN_ORDER } from '@/lib/constants/days-of-week';
import { ScheduleForm } from '@/components/features/forms/ScheduleForm';
import { db } from '@/drizzle/db';
import { SchedulesTable } from '@/drizzle/schema';
import { getBlockedDates } from '@/server/actions/blocked-dates';
import { markStepComplete } from '@/server/actions/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

type Availability = {
  startTime: string;
  endTime: string;
  dayOfWeek: (typeof DAYS_OF_WEEK_IN_ORDER)[number];
};

/**
 * Schedule Page - AuthKit Implementation
 *
 * Allows experts to set their availability schedule.
 * Automatically marks 'availability' setup step as complete when schedule exists.
 */
export default async function SchedulePage() {
  // Require authentication - auto-redirects if not logged in
  const { user } = await withAuth({ ensureSignedIn: true });

  const [scheduleData, blockedDates] = await Promise.all([
    db.query.SchedulesTable.findFirst({
      where: eq(SchedulesTable.workosUserId, user.id),
      with: { availabilities: true },
    }),
    getBlockedDates(),
  ]);

  // Transform the schedule data to match ScheduleForm expectations
  const schedule = scheduleData
    ? {
        timezone: scheduleData.timezone,
        availabilities: scheduleData.availabilities as Availability[],
      }
    : undefined;

  // If the schedule exists and has at least one day with availability, mark step as complete
  if (schedule && schedule.availabilities.length > 0) {
    // Mark availability step as complete (non-blocking)
    try {
      await markStepComplete('availability');
    } catch (error) {
      console.error('Failed to mark availability step as complete:', error);
    }
  }

  return (
    <div className="w-full">
      <ScheduleForm schedule={schedule} blockedDates={blockedDates} />
    </div>
  );
}
