import type { DAYS_OF_WEEK_IN_ORDER } from '@/lib/constants/days-of-week';
import { db } from '@/drizzle/db';
import type { ScheduleAvailabilitiesTable } from '@/drizzle/schema';
import {
  addMinutes,
  isFriday,
  isMonday,
  isSameDay,
  isSaturday,
  isSunday,
  isThursday,
  isTuesday,
  isWednesday,
  isWithinInterval,
  setHours,
  setMinutes,
  startOfDay,
  subMinutes,
} from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

interface ScheduleEvent {
  workosUserId: string;
  durationInMinutes: number;
}

export async function getValidTimesFromSchedule(
  times: Date[],
  event: ScheduleEvent,
  calendarEvents: Array<{ start: Date; end: Date }>,
) {
  const schedule = await db.query.SchedulesTable.findFirst({
    where: ({ workosUserId: userIdCol }, { eq }) => eq(userIdCol, event.workosUserId),
    with: { availabilities: true },
  });

  if (schedule == null) return [];

  // Get active slot reservations for this expert
  const currentTime = new Date();
  const activeReservations = await db.query.SlotReservationsTable.findMany({
    where: (fields, { eq, and, gt }) =>
      and(eq(fields.workosUserId, event.workosUserId), gt(fields.expiresAt, currentTime)),
  });

  // Convert reservations to a Set for faster lookup
  const reservedTimes = new Set(
    activeReservations.map((reservation) => reservation.startTime.toISOString()),
  );

  // Only log detailed reservation info in development
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[getValidTimesFromSchedule] Found ${activeReservations.length} active slot reservations:`,
      {
        expertId: event.workosUserId,
        reservedSlots: activeReservations.map((r) => ({
          startTime: r.startTime.toISOString(),
          guestEmail: r.guestEmail,
          expiresAt: r.expiresAt.toISOString(),
        })),
      },
    );
  } else {
    // In production, just log the count
    console.log(
      `[getValidTimesFromSchedule] Found ${activeReservations.length} active slot reservations for expert ${event.workosUserId}`,
    );
  }

  // Get scheduling settings for minimum notice period and buffer times
  const settings = await db.query.SchedulingSettingsTable.findFirst({
    where: ({ workosUserId: userIdCol }, { eq }) => eq(userIdCol, event.workosUserId),
  });

  const minimumNotice = settings?.minimumNotice ?? 1440; // Default to 24 hours if not set
  const beforeEventBuffer = settings?.beforeEventBuffer ?? 15; // Default to 15 minutes if not set
  const afterEventBuffer = settings?.afterEventBuffer ?? 15; // Default to 15 minutes if not set

  const now = new Date();
  const earliestPossibleTime = addMinutes(now, minimumNotice);

  // Calculate if we should use day-level granularity
  // If minimum notice is 24 hours or more, we'll use day-level granularity
  const useDayGranularity = minimumNotice >= 1440;

  // For day-level granularity, calculate the earliest possible day
  const earliestStartOfDay = startOfDay(earliestPossibleTime);

  const validTimes = [];
  for (const time of times) {
    // Check if this time slot is currently reserved
    if (reservedTimes.has(time.toISOString())) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[getValidTimesFromSchedule] Skipping reserved slot: ${time.toISOString()}`);
      }
      continue;
    }

    // For short notice periods (< 24 hours), use exact time comparison
    if (!useDayGranularity) {
      if (time < earliestPossibleTime) continue;
    } else {
      // For longer notice periods (>= 24 hours)
      const timeStartOfDay = startOfDay(time);

      // If the day is before the earliest possible day, skip it
      if (timeStartOfDay < earliestStartOfDay) continue;

      // If it's the transition day (the day when minimum notice ends),
      // only show times after the minimum notice period
      if (isSameDay(timeStartOfDay, earliestStartOfDay)) {
        if (time < earliestPossibleTime) continue;
      }
      // For all subsequent days, show all available times
      // No additional time filtering needed here
    }

    // Check if time conflicts with any calendar event, including buffer times
    const hasCalendarConflict = calendarEvents.some((calendarEvent) => {
      const meetingStartWithBuffer = subMinutes(time, beforeEventBuffer);
      const meetingEndWithBuffer = addMinutes(
        addMinutes(time, event.durationInMinutes),
        afterEventBuffer,
      );

      // Check if the meeting time (including buffers) overlaps with any calendar event
      return (
        (meetingStartWithBuffer >= calendarEvent.start &&
          meetingStartWithBuffer < calendarEvent.end) ||
        (meetingEndWithBuffer > calendarEvent.start && meetingEndWithBuffer <= calendarEvent.end) ||
        (meetingStartWithBuffer <= calendarEvent.start && meetingEndWithBuffer >= calendarEvent.end)
      );
    });

    if (hasCalendarConflict) continue;

    const groupedAvailabilities = Object.groupBy(schedule.availabilities, (a) => a.dayOfWeek);

    const availabilities = getAvailabilities(groupedAvailabilities, time, schedule.timezone);
    const eventInterval = {
      start: subMinutes(time, beforeEventBuffer), // Include buffer before event
      end: addMinutes(addMinutes(time, event.durationInMinutes), afterEventBuffer), // Include buffer after event
    };

    const isTimeValid = availabilities.some(
      (availability) =>
        isWithinInterval(eventInterval.start, availability) &&
        isWithinInterval(eventInterval.end, availability),
    );

    if (isTimeValid) {
      validTimes.push(time);
    }
  }

  // Only log detailed results in development
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[getValidTimesFromSchedule] Returning ${validTimes.length} valid times out of ${times.length} requested`,
    );
  }

  return validTimes;
}

function getAvailabilities(
  groupedAvailabilities: Partial<
    Record<
      (typeof DAYS_OF_WEEK_IN_ORDER)[number],
      (typeof ScheduleAvailabilitiesTable.$inferSelect)[]
    >
  >,
  date: Date,
  timezone: string,
) {
  let availabilities: (typeof ScheduleAvailabilitiesTable.$inferSelect)[] | undefined;

  if (isMonday(date)) {
    availabilities = groupedAvailabilities.monday;
  }
  if (isTuesday(date)) {
    availabilities = groupedAvailabilities.tuesday;
  }
  if (isWednesday(date)) {
    availabilities = groupedAvailabilities.wednesday;
  }
  if (isThursday(date)) {
    availabilities = groupedAvailabilities.thursday;
  }
  if (isFriday(date)) {
    availabilities = groupedAvailabilities.friday;
  }
  if (isSaturday(date)) {
    availabilities = groupedAvailabilities.saturday;
  }
  if (isSunday(date)) {
    availabilities = groupedAvailabilities.sunday;
  }

  if (availabilities == null) return [];

  return availabilities.map(({ startTime, endTime }) => {
    const start = fromZonedTime(
      setMinutes(
        setHours(date, Number.parseInt(startTime.split(':')[0])),
        Number.parseInt(startTime.split(':')[1]),
      ),
      timezone,
    );

    const end = fromZonedTime(
      setMinutes(
        setHours(date, Number.parseInt(endTime.split(':')[0])),
        Number.parseInt(endTime.split(':')[1]),
      ),
      timezone,
    );

    return { start, end };
  });
}
