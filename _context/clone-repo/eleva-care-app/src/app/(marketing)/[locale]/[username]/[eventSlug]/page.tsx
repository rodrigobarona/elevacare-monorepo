import { getProfileAccessData, ProfileAccessControl } from '@/components/auth/ProfileAccessControl';
import { BookingLoadingSkeleton } from '@/components/features/booking/BookingLoadingSkeleton';
import { MeetingForm } from '@/components/features/forms/MeetingForm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { db } from '@/drizzle/db';
import {
  DEFAULT_AFTER_EVENT_BUFFER,
  DEFAULT_BEFORE_EVENT_BUFFER,
  DEFAULT_BOOKING_WINDOW_DAYS,
  DEFAULT_MINIMUM_NOTICE,
  DEFAULT_TIME_SLOT_INTERVAL,
} from '@/lib/constants/scheduling';
import { Link } from '@/lib/i18n/navigation';
import { getValidTimesFromSchedule } from '@/lib/utils/server/scheduling';
import { getBlockedDatesForUser } from '@/server/actions/blocked-dates';
import GoogleCalendarService from '@/server/googleCalendar';
import {
  addDays,
  addMinutes,
  endOfDay,
  type NearestMinutes,
  roundToNearestMinutes,
  setHours,
  setMinutes,
  startOfDay,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

// Updated PageProps type with proper next params - both params and searchParams as Promises
interface PageProps {
  params: Promise<{
    username: string;
    eventSlug: string;
    locale: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Define EventType to avoid conflict with DOM Event
interface EventType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationInMinutes: number;
  workosUserId: string;
  isActive: boolean;
  order: number;
  price: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default async function BookEventPage(props: PageProps) {
  const { username, eventSlug, locale } = await props.params;

  return (
    <ProfileAccessControl username={username} context="BookEventPage" additionalPath={eventSlug}>
      <BookEventPageContent username={username} eventSlug={eventSlug} locale={locale} />
    </ProfileAccessControl>
  );
}

// Separate component for the actual content
async function BookEventPageContent({
  username,
  eventSlug,
  locale,
}: {
  username: string;
  eventSlug: string;
  locale: string;
}) {
  // Get user data - we know it exists because ProfileAccessControl validated it
  const data = await getProfileAccessData(username);
  if (!data) {
    return notFound(); // This shouldn't happen due to ProfileAccessControl
  }

  const { user } = data;

  const event = await db.query.EventsTable.findFirst({
    where: ({ workosUserId: userIdCol, isActive, slug }, { eq, and }) =>
      and(eq(isActive, true), eq(userIdCol, user.id), eq(slug, eventSlug)),
  });

  if (event == null) return notFound();

  // Fetch user from database (WorkOS)
  const calendarUser = await db.query.UsersTable.findFirst({
    where: (users, { eq }) => eq(users.workosUserId, user.id),
  });

  // Handle case where user is not found
  if (!calendarUser) {
    return notFound();
  }

  return (
    <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center justify-center p-4 md:mt-0 md:h-dvh md:p-6">
      <CardContent className="p-0 pt-8">
        {/* Use Suspense to wrap the availability-dependent component */}
        <Suspense fallback={<CalendarLoadingSkeleton />}>
          <CalendarWithAvailability
            userId={user.id}
            eventId={event.id}
            username={username}
            eventSlug={eventSlug}
            price={event.price}
            event={event}
            calendarUser={calendarUser}
            locale={locale}
          />
        </Suspense>
      </CardContent>
    </div>
  );
}

// New component to handle availability data fetching
async function CalendarWithAvailability({
  userId,
  eventId,
  username,
  eventSlug,
  price,
  event,
  calendarUser: _calendarUser,
  locale,
}: {
  userId: string;
  eventId: string;
  username: string;
  eventSlug: string;
  price: number;
  event: EventType;
  calendarUser: {
    id: string;
    workosUserId: string;
    email: string;
    imageUrl: string | null;
  };
  locale: string;
}) {
  const calendarService = GoogleCalendarService.getInstance();

  // Verify calendar access before fetching times
  const hasValidTokens = await calendarService.hasValidTokens(userId);
  if (!hasValidTokens) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Calendar Access Required</CardTitle>
          <CardDescription>
            The calendar owner needs to reconnect their Google Calendar to show available times.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Fetch scheduling settings for the user
  let timeSlotInterval = DEFAULT_TIME_SLOT_INTERVAL;
  let bookingWindowDays = DEFAULT_BOOKING_WINDOW_DAYS;
  let minimumNotice = DEFAULT_MINIMUM_NOTICE;
  let beforeEventBuffer = DEFAULT_BEFORE_EVENT_BUFFER;
  let afterEventBuffer = DEFAULT_AFTER_EVENT_BUFFER;
  try {
    const settings = await db.query.SchedulingSettingsTable.findFirst({
      where: ({ workosUserId: userIdCol }, { eq }) => eq(userIdCol, userId),
    });

    if (settings?.timeSlotInterval) {
      timeSlotInterval = settings.timeSlotInterval;
    }
    if (settings?.bookingWindowDays) {
      bookingWindowDays = settings.bookingWindowDays;
    }
    if (settings?.minimumNotice) {
      minimumNotice = settings.minimumNotice;
    }
    if (settings?.beforeEventBuffer) {
      beforeEventBuffer = settings.beforeEventBuffer;
    }
    if (settings?.afterEventBuffer) {
      afterEventBuffer = settings.afterEventBuffer;
    }
  } catch (error) {
    console.error('[CalendarWithAvailability] Error fetching scheduling settings:', error);
    // Continue with the default values
  }

  const now = new Date();
  const useDayGranularity = minimumNotice >= 1440; // 24 hours or more

  // Calculate the earliest possible time based on minimum notice
  const earliestPossibleTime = addMinutes(now, minimumNotice);

  // For day-level granularity (>= 24 hours notice), start from the beginning of each day
  // after the minimum notice period
  let startDate: Date;

  if (useDayGranularity) {
    // For notice periods >= 24 hours, use the start of the next day
    const earliestDay = startOfDay(earliestPossibleTime);
    startDate = setMinutes(setHours(earliestDay, 0), 0);
  } else {
    // For shorter notice periods, use exact time with rounding
    const roundingInterval = timeSlotInterval <= 30 ? timeSlotInterval : 30;

    if (timeSlotInterval <= 30) {
      startDate = new Date(
        formatInTimeZone(
          roundToNearestMinutes(earliestPossibleTime, {
            nearestTo: roundingInterval as NearestMinutes,
            roundingMethod: 'ceil',
          }),
          'UTC',
          "yyyy-MM-dd'T'HH:mm:ssX",
        ),
      );
    } else {
      const roundedTo30 = roundToNearestMinutes(earliestPossibleTime, {
        nearestTo: 30 as NearestMinutes,
        roundingMethod: 'ceil',
      });

      const minutes = roundedTo30.getMinutes();
      const extraMinutes = minutes % timeSlotInterval;

      if (extraMinutes > 0) {
        roundedTo30.setMinutes(minutes + (timeSlotInterval - extraMinutes));
      }

      startDate = new Date(formatInTimeZone(roundedTo30, 'UTC', "yyyy-MM-dd'T'HH:mm:ssX"));
    }
  }

  const endDate = new Date(
    formatInTimeZone(
      endOfDay(addDays(startDate, bookingWindowDays)),
      'UTC',
      "yyyy-MM-dd'T'HH:mm:ssX",
    ),
  );

  // Get calendar events and calculate valid times
  const calendarEvents = await calendarService.getCalendarEventTimes(userId, {
    start: startDate,
    end: endDate,
  });

  // Generate time slots based on the configured interval
  const timeSlots = [];
  let currentTime = new Date(startDate);

  // For day-level granularity, ensure we start from the beginning of the day
  if (useDayGranularity) {
    currentTime = setMinutes(setHours(startOfDay(currentTime), 0), 0);
  }

  while (currentTime < endDate) {
    timeSlots.push(new Date(currentTime));
    currentTime = new Date(currentTime.getTime() + timeSlotInterval * 60000);
  }

  const validTimes = await getValidTimesFromSchedule(timeSlots, event, calendarEvents);

  if (validTimes.length === 0) {
    return <NoTimeSlots username={username} _locale={locale} />;
  }

  // Fetch blocked dates for this user
  const blockedDates = await getBlockedDatesForUser(userId);

  // Enhanced MeetingForm with better metadata and buffer times
  return (
    <MeetingForm
      validTimes={validTimes}
      eventId={eventId}
      workosUserId={userId}
      price={price}
      username={username}
      eventSlug={eventSlug}
      expertName={username}
      expertImageUrl={'/placeholder-avatar.jpg'} // TODO: Fetch from ProfilesTable if needed
      eventTitle={event.name}
      eventDescription={event.description || 'Book a consultation session'}
      eventDuration={event.durationInMinutes}
      eventLocation="Google Meet"
      locale={locale}
      beforeEventBuffer={beforeEventBuffer}
      afterEventBuffer={afterEventBuffer}
      blockedDates={blockedDates}
    />
  );
}

// Use the reusable booking loading skeleton
function CalendarLoadingSkeleton() {
  return <BookingLoadingSkeleton />;
}

function NoTimeSlots({ username, _locale }: { username: string; _locale: string }) {
  // Use username for display (professional name would come from ProfilesTable if needed)
  const expertName = 'This expert';

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>No Available Time Slots</CardTitle>
        <CardDescription>
          {expertName} doesn&apos;t have any available time slots in the next two months.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        <p>This could be because:</p>
        <ul className="ml-6 mt-2 list-disc">
          <li>Their calendar is fully booked</li>
          <li>They haven&apos;t set up their availability yet</li>
          <li>They&apos;re temporarily unavailable</li>
        </ul>
      </CardContent>
      <CardFooter>
        <Link
          href={{
            pathname: '/[username]',
            params: { username },
          }}
        >
          <Button variant="secondary">View Profile</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
