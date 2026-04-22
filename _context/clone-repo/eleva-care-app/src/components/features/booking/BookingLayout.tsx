'use client';

import * as React from 'react';
import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTimezoneOffset } from '@/lib/utils/formatters';
import { startOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { Clock, CreditCard, Globe, Info, Video } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface BlockedDate {
  id: number;
  date: Date;
  reason?: string;
  timezone: string;
}

interface ExpertInfo {
  id: string;
  name: string;
  imageUrl: string;
  location?: string;
  username?: string;
}

interface EventInfo {
  id: string;
  title: string;
  description: string;
  duration: number;
  price: number;
  location: string;
}

interface TimeSlot {
  utcDate: Date;
  localDate: Date;
  localDateOnly: Date;
  displayTime: string;
}

interface BookingLayoutProps {
  expert: ExpertInfo;
  event: EventInfo;
  validTimes: Date[];
  onDateSelect?: (date: Date) => void;
  onTimeSlotSelect?: (date: Date) => void;
  selectedDate?: Date | null;
  selectedTime?: Date | null;
  timezone: string;
  onTimezoneChange?: (timezone: string) => void;
  showCalendar?: boolean;
  children?: React.ReactNode;
  blockedDates?: BlockedDate[];
}

function BookingLayoutInner({
  expert,
  event,
  validTimes,
  onDateSelect,
  onTimeSlotSelect,
  selectedDate,
  selectedTime,
  timezone,
  onTimezoneChange,
  showCalendar = true,
  children,
  blockedDates,
}: BookingLayoutProps) {
  const [use24Hour, setUse24Hour] = React.useState(false);

  // Get all available timezones
  const availableTimezones = React.useMemo(() => Intl.supportedValuesOf('timeZone'), []);

  // Format timezones for display
  const formattedTimezones = React.useMemo(() => {
    return availableTimezones.map((tz) => ({
      value: tz,
      label: `${tz.replace('_', ' ').replace('/', ' - ')} (${formatTimezoneOffset(tz)})`,
    }));
  }, [availableTimezones]);

  // Process time slots based on timezone
  const validTimesInTimezone = React.useMemo(() => {
    return validTimes.map((utcDate) => {
      const zonedDate = toZonedTime(utcDate, timezone);
      const displayTime = formatInTimeZone(utcDate, timezone, use24Hour ? 'HH:mm' : 'h:mm a');
      const localDateOnly = startOfDay(zonedDate);

      return {
        utcDate,
        localDate: zonedDate,
        localDateOnly,
        displayTime,
      };
    });
  }, [validTimes, timezone, use24Hour]);

  // Group time slots by date
  const timesByDate = React.useMemo(() => {
    return validTimesInTimezone.reduce(
      (acc, time) => {
        const dateKey = time.localDateOnly.toISOString();
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(time);
        return acc;
      },
      {} as Record<string, TimeSlot[]>,
    );
  }, [validTimesInTimezone]);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date && onDateSelect) {
      onDateSelect(date);
    }
  };

  // Handle time slot selection
  const handleTimeSelect = (time: TimeSlot) => {
    if (onTimeSlotSelect) {
      onTimeSlotSelect(time.utcDate);
    }
  };

  // Function to check if a date is blocked
  const isDateBlocked = React.useCallback(
    (date: Date) => {
      if (!blockedDates || blockedDates.length === 0) return false;

      return blockedDates.some((blocked) => {
        const calendarDateInTz = toZonedTime(date, blocked.timezone);
        const blockedDateInTz = toZonedTime(blocked.date, blocked.timezone);

        return (
          formatInTimeZone(calendarDateInTz, blocked.timezone, 'yyyy-MM-dd') ===
          formatInTimeZone(blockedDateInTz, blocked.timezone, 'yyyy-MM-dd')
        );
      });
    },
    [blockedDates],
  );

  // Format price for display
  const formattedPrice = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(event.price / 100);

  return (
    <>
      <div
        className={cn(
          'grid h-full grid-cols-1 gap-0 overflow-hidden rounded-lg border md:grid-flow-col md:border-none',
          showCalendar ? 'md:grid-cols-[300px_1fr_300px]' : 'md:grid-cols-[300px_1fr]',
        )}
      >
        {/* Left column - Expert Profile */}
        <div
          className={cn(
            'flex h-full flex-col space-y-6 p-6 pr-0 md:border',
            showCalendar ? 'md:rounded-l-lg md:border-r-0' : 'md:rounded-lg',
          )}
        >
          <div className="flex items-center space-x-4">
            {expert.username ? (
              <Link href={`/${expert.username}`} className="group">
                <Avatar className="h-10 w-10 transition-all duration-200 group-hover:ring-2 group-hover:ring-primary/50">
                  <AvatarImage src={expert.imageUrl} alt={expert.name} />
                  <AvatarFallback>{expert.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage src={expert.imageUrl} alt={expert.name} />
                <AvatarFallback>{expert.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <div>
              {expert.username ? (
                <Link
                  href={`/${expert.username}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {expert.name}
                </Link>
              ) : (
                <h3 className="font-medium">{expert.name}</h3>
              )}
              {expert.location && (
                <p className="text-sm text-muted-foreground">{expert.location}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{event.title}</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="View event description"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{event.title}</DialogTitle>
                    <DialogDescription>
                      Duration: {event.duration}m | Call: {event.location}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="prose prose-sm mt-4 max-h-[60vh] overflow-y-auto">
                    <ReactMarkdown>{event.description}</ReactMarkdown>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-3 pt-3 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              <span>{event.duration}m</span>
            </div>
            <div className="flex items-center">
              <Video className="mr-2 h-4 w-4" />
              <span>{event.location}</span>
            </div>
            {event.price > 0 && (
              <div className="flex items-center">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>{formattedPrice}</span>
              </div>
            )}
            <div className="flex w-full flex-col gap-2">
              <Select value={timezone} onValueChange={(value) => onTimezoneChange?.(value)}>
                <SelectTrigger className="h-9 w-full -translate-x-2 border-none px-2 text-sm shadow-none hover:bg-eleva-neutral-100 focus:ring-0">
                  <Globe className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={timezone.replace('_', ' ')} />
                </SelectTrigger>
                <SelectContent>
                  {formattedTimezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value} className="text-sm">
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Middle column - Custom content or Calendar */}
        {children ? (
          <div className="h-full md:border md:border-l-0">{children}</div>
        ) : showCalendar ? (
          <>
            {/* Mobile: Vertically stacked Calendar and Time slots */}
            <div className="border border-t-0 md:hidden">
              {/* Calendar for mobile */}
              <div className="border-b p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate || undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    if (!date) return true;
                    const dateKey = startOfDay(date).toISOString();
                    return !timesByDate[dateKey] || isDateBlocked(date);
                  }}
                  showOutsideDays={false}
                  fixedWeeks
                  className="relative w-full rounded-md p-3"
                  classNames={{
                    months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                    month: 'space-y-4 w-full',
                    month_caption: 'flex justify-start pt-1 relative items-center gap-1',
                    caption_label: 'text-lg font-semibold',
                    dropdowns: 'flex gap-1',
                    nav: 'flex items-center gap-1 absolute right-0 top-1 z-10',
                    button_previous:
                      'h-9 w-9 bg-transparent p-0 hover:opacity-100 opacity-75 relative',
                    button_next:
                      'h-9 w-9 bg-transparent p-0 hover:opacity-100 opacity-75 relative ml-1',
                    month_grid: 'w-full border-collapse',
                    weekdays: 'flex w-full',
                    weekday: 'h-6 w-14 font-normal text-sm text-muted-foreground uppercase',
                    week: 'flex w-full',
                    day: 'h-14 w-14 relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected])]:rounded-md',
                    day_button:
                      'text-center h-14 w-14 p-0 font-normal text-base aria-selected:opacity-100 hover:bg-eleva-neutral-100 hover:text-eleva-neutral-900 transition-colors duration-200',
                    range_start: 'day-range-start',
                    range_end: 'day-range-end',
                    selected:
                      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-white',
                    today: 'border-2 border-primary text-primary font-medium',
                    outside:
                      'text-muted-foreground/50 hover:bg-transparent hover:cursor-default aria-selected:bg-muted/30 aria-selected:text-muted-foreground/50',
                    disabled:
                      'text-muted-foreground/30 hover:bg-transparent hover:cursor-not-allowed line-through',
                    hidden: 'invisible',
                  }}
                />
              </div>

              {/* Time slots for mobile */}
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {selectedDate
                      ? formatInTimeZone(selectedDate, timezone, 'EE, d')
                      : 'Available Times'}
                  </h2>
                  <div className="flex rounded-full bg-muted p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'rounded-full px-4 text-sm font-normal',
                        !use24Hour
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
                      )}
                      onClick={() => setUse24Hour(false)}
                    >
                      12h
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'rounded-full px-4 text-sm font-normal',
                        use24Hour
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
                      )}
                      onClick={() => setUse24Hour(true)}
                    >
                      24h
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 overflow-y-auto pr-2">
                  {selectedDate &&
                    timesByDate[startOfDay(selectedDate).toISOString()]?.map((timeSlot) => (
                      <Button
                        key={timeSlot.utcDate.toISOString()}
                        type="button"
                        variant="outline"
                        className={cn(
                          'h-12 justify-center text-center text-base font-normal',
                          selectedTime?.toISOString() === timeSlot.utcDate.toISOString()
                            ? 'border-primary bg-primary/5 font-medium text-primary'
                            : 'hover:border-primary/50',
                        )}
                        onClick={() => handleTimeSelect(timeSlot)}
                      >
                        {timeSlot.displayTime}
                      </Button>
                    ))}
                  {(!selectedDate || !timesByDate[startOfDay(selectedDate).toISOString()]) && (
                    <div className="py-8 text-center text-muted-foreground">
                      {selectedDate
                        ? 'No available times for this date'
                        : 'Select a date to view available times'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop: Middle column - Calendar */}
            <div className={cn('hidden h-full p-2 md:block md:border md:border-l-0 md:border-r-0')}>
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  if (!date) return true;
                  const dateKey = startOfDay(date).toISOString();
                  return !timesByDate[dateKey] || isDateBlocked(date);
                }}
                showOutsideDays={false}
                fixedWeeks
                className="relative w-full rounded-md p-3"
                classNames={{
                  months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                  month: 'space-y-4 w-full',
                  month_caption: 'flex justify-start pt-1 relative items-center gap-1',
                  caption_label: 'text-lg font-semibold',
                  dropdowns: 'flex gap-1',
                  nav: 'flex items-center gap-1 absolute right-0 top-1 z-10',
                  button_previous:
                    'h-9 w-9 bg-transparent p-0 hover:opacity-100 opacity-75 relative',
                  button_next:
                    'h-9 w-9 bg-transparent p-0 hover:opacity-100 opacity-75 relative ml-1',
                  month_grid: 'w-full border-collapse',
                  weekdays: 'flex w-full',
                  weekday: 'h-6 w-14 font-normal text-sm text-muted-foreground uppercase',
                  week: 'flex w-full',
                  day: 'h-14 w-14 relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected])]:rounded-md',
                  day_button:
                    'text-center h-14 w-14 p-0 font-normal text-base aria-selected:opacity-100 hover:bg-eleva-neutral-100 hover:text-eleva-neutral-900 transition-colors duration-200',
                  range_start: 'day-range-start',
                  range_end: 'day-range-end',
                  selected:
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-white',
                  today: 'border-2 border-primary text-primary font-medium',
                  outside:
                    'text-muted-foreground/50 hover:bg-transparent hover:cursor-default aria-selected:bg-muted/30 aria-selected:text-muted-foreground/50',
                  disabled:
                    'text-muted-foreground/30 hover:bg-transparent hover:cursor-not-allowed line-through',
                  hidden: 'invisible',
                }}
              />
            </div>

            {/* Desktop: Right column - Time Slots */}
            <div
              className={cn('hidden h-full p-6 md:block md:rounded-r-lg md:border md:border-l-0')}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {selectedDate
                    ? formatInTimeZone(selectedDate, timezone, 'EE, d')
                    : 'Available Times'}
                </h2>
                <div className="flex rounded-full bg-muted p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'rounded-full px-4 text-sm font-normal',
                      !use24Hour
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
                    )}
                    onClick={() => setUse24Hour(false)}
                  >
                    12h
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'rounded-full px-4 text-sm font-normal',
                      use24Hour
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
                    )}
                    onClick={() => setUse24Hour(true)}
                  >
                    24h
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 overflow-y-auto pr-2 md:h-[calc(400px-3.8rem)]">
                {selectedDate &&
                  timesByDate[startOfDay(selectedDate).toISOString()]?.map((timeSlot) => (
                    <Button
                      key={timeSlot.utcDate.toISOString()}
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-12 justify-center text-center text-base font-normal',
                        selectedTime?.toISOString() === timeSlot.utcDate.toISOString()
                          ? 'border-primary bg-primary/5 font-medium text-primary'
                          : 'hover:border-primary/50',
                      )}
                      onClick={() => handleTimeSelect(timeSlot)}
                    >
                      {timeSlot.displayTime}
                    </Button>
                  ))}
                {(!selectedDate || !timesByDate[startOfDay(selectedDate).toISOString()]) && (
                  <div className="py-8 text-center text-muted-foreground">
                    {selectedDate
                      ? 'No available times for this date'
                      : 'Select a date to view available times'}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

export function BookingLayout(props: BookingLayoutProps) {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load the booking calendar">
      <BookingLayoutInner {...props} />
    </ComponentErrorBoundary>
  );
}
