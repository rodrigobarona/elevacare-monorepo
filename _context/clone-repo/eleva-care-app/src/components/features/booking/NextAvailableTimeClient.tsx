'use client';

import {
  ComponentErrorFallback,
  handleComponentError,
} from '@/components/shared/ComponentErrorFallback';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatInTimeZone } from 'date-fns-tz';
import React, { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

interface NextAvailableTimeClientProps {
  date: Date | string | null;
  eventName: string;
  eventSlug: string;
  username: string;
  baseUrl?: string;
}

function isToday(date: Date, now: Date) {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isTomorrow(date: Date, now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

const NextAvailableTimeContent = React.memo(function NextAvailableTimeContent({
  date,
  eventSlug,
  username,
  baseUrl,
}: NextAvailableTimeClientProps) {
  const parsedDate = React.useMemo(() => {
    if (!date) return null;
    try {
      const dateInstance = typeof date === 'string' ? new Date(date) : date;
      if (Number.isNaN(dateInstance.getTime())) return null;
      return dateInstance;
    } catch {
      return null;
    }
  }, [date]);

  const userTimeZone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const bookingLink = React.useMemo(() => {
    if (!parsedDate || !username || !eventSlug) return null;
    try {
      const dateParam = parsedDate.toISOString().split('T')[0];
      const timeParam = parsedDate.toISOString();
      const basePath = baseUrl
        ? `${baseUrl}/${username}/${eventSlug}`
        : `/${username}/${eventSlug}`;
      const searchParams = new URLSearchParams({
        d: dateParam,
        t: timeParam,
        s: '2',
      });
      return `${basePath}?${searchParams.toString()}`;
    } catch {
      return '#';
    }
  }, [parsedDate, username, eventSlug, baseUrl]);

  const formattedTime = React.useMemo(() => {
    if (!parsedDate) return null;
    try {
      const timeFormat = 'h:mm a';
      const now = new Date();
      const formatted = formatInTimeZone(parsedDate, userTimeZone, timeFormat);

      if (isToday(parsedDate, now)) return `Today at ${formatted}`;
      if (isTomorrow(parsedDate, now)) return `Tomorrow at ${formatted}`;
      return formatInTimeZone(parsedDate, userTimeZone, 'EEE, h:mm a');
    } catch {
      return parsedDate.toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: userTimeZone,
        timeZoneName: 'short',
      });
    }
  }, [parsedDate, userTimeZone]);

  const tooltipLabel = React.useMemo(() => {
    if (!parsedDate) return '';
    try {
      return formatInTimeZone(
        parsedDate,
        userTimeZone,
        "'Book on' EEEE, MMM d 'at' h:mm a '('z')'",
      );
    } catch {
      return '';
    }
  }, [parsedDate, userTimeZone]);

  if (!parsedDate || !formattedTime) {
    return <div className="text-sm text-muted-foreground">No times available</div>;
  }

  return (
    <div className="mb-6 text-sm text-muted-foreground">
      <TooltipProvider>
        <span>Next available — </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href={bookingLink ?? '#'} className="cursor-pointer hover:underline">
              {formattedTime}
            </a>
          </TooltipTrigger>
          <TooltipContent>{tooltipLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});

function NextAvailableTimeClient(props: NextAvailableTimeClientProps) {
  return (
    <ErrorBoundary
      FallbackComponent={(fallbackProps) => (
        <ComponentErrorFallback {...fallbackProps} message="No times available" />
      )}
      onError={handleComponentError}
    >
      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">Loading next available time...</div>
        }
      >
        <NextAvailableTimeContent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

export default NextAvailableTimeClient;
