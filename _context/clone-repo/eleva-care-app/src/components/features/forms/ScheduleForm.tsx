'use client';

import { DAYS_OF_WEEK_IN_ORDER } from '@/lib/constants/days-of-week';
import { BlockedDates } from '@/components/shared/blocked-dates/BlockedDates';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TimezoneSelect } from '@/components/ui/timezone-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, timeToInt } from '@/lib/utils';
import { scheduleFormSchema } from '@/schema/schedule';
import {
  addBlockedDates,
  getBlockedDates,
  removeBlockedDate,
  updateBlockedDate,
} from '@/server/actions/blocked-dates';
import { saveSchedule } from '@/server/actions/schedule';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push({ value: time, label: time });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

type Availability = {
  startTime: string;
  endTime: string;
  dayOfWeek: (typeof DAYS_OF_WEEK_IN_ORDER)[number];
};

interface BlockedDate {
  id: number;
  date: Date;
  reason?: string;
  timezone: string;
}

export function ScheduleForm({
  schedule,
  blockedDates: initialBlockedDates = [],
}: {
  schedule?: {
    timezone: string;
    availabilities: Availability[];
  };
  blockedDates?: BlockedDate[];
}) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>(initialBlockedDates);

  const form = useForm<z.infer<typeof scheduleFormSchema>>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      timezone: schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      availabilities: schedule?.availabilities.toSorted((a, b) => {
        return timeToInt(a.startTime) - timeToInt(b.startTime);
      }),
    },
  });

  const {
    append: addAvailability,
    remove: removeAvailability,
    fields: availabilityFields,
  } = useFieldArray({ name: 'availabilities', control: form.control });

  const groupedAvailabilityFields = Object.groupBy(
    availabilityFields.map((field, index) => ({ ...field, index })),
    (availability) => availability.dayOfWeek,
  );

  // Add protection against unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.formState.isDirty]);

  // Add handlers for blocked dates
  const handleAddBlockedDates = useCallback(
    async (dates: { date: Date; reason?: string }[]) => {
      try {
        const timezone = form.getValues('timezone');
        await addBlockedDates(
          dates.map((date) => ({
            date: date.date,
            reason: date.reason,
            timezone,
          })),
        );
        // Refresh blocked dates after adding
        const updatedBlockedDates = await getBlockedDates();
        setBlockedDates(updatedBlockedDates);
        toast.success('Dates blocked successfully');
      } catch (error) {
        console.error('Error adding blocked dates:', error);
        toast.error('Failed to add blocked dates');
      }
    },
    [form],
  );

  const handleRemoveBlockedDate = useCallback(async (id: number) => {
    try {
      await removeBlockedDate(id);
      // Refresh blocked dates after removing
      const updatedBlockedDates = await getBlockedDates();
      setBlockedDates(updatedBlockedDates);
      toast.success('Date unblocked successfully');
    } catch (error) {
      console.error('Error removing blocked date:', error);
      toast.error('Failed to remove blocked date');
    }
  }, []);

  // Add handlers for blocked dates
  const handleEditBlockedDate = useCallback(
    async (id: number, updates: { date: Date; reason?: string }) => {
      const timezone = form.getValues('timezone');

      // Store the original for rollback
      const originalDate = blockedDates.find((d) => d.id === id);
      if (!originalDate) {
        toast.error('Original date not found');
        return;
      }

      try {
        // Optimistically update UI first
        setBlockedDates((prev) =>
          prev.map((d) => (d.id === id ? { ...d, ...updates, timezone } : d)),
        );

        // Perform atomic update operation
        const updatedDate = await updateBlockedDate(id, { ...updates, timezone });

        // Update state with the returned data from server
        setBlockedDates((prev) => prev.map((d) => (d.id === id ? updatedDate : d)));

        toast.success('Date updated successfully');
      } catch (error) {
        console.error('Error updating blocked date:', error);

        // Rollback optimistic update on failure
        setBlockedDates((prev) => prev.map((d) => (d.id === id ? originalDate : d)));

        toast.error('Failed to update blocked date');

        // Refresh the list to ensure we're in sync with the server
        try {
          const updatedBlockedDates = await getBlockedDates();
          setBlockedDates(updatedBlockedDates);
        } catch (refreshError) {
          console.error('Error refreshing blocked dates:', refreshError);
          toast.error('Failed to refresh blocked dates. Please reload the page.');
        }
      }
    },
    [form, blockedDates],
  );

  // Load blocked dates on component mount
  useEffect(() => {
    const loadBlockedDates = async () => {
      try {
        const dates = await getBlockedDates();
        setBlockedDates(dates);
      } catch (error) {
        console.error('Error loading blocked dates:', error);
        toast.error('Failed to load blocked dates');
      }
    };

    loadBlockedDates();
  }, []);

  async function onSubmit(values: z.infer<typeof scheduleFormSchema>) {
    try {
      const data = await saveSchedule(values);
      if (data?.error) {
        toast.error('Failed to save schedule');
        form.setError('root', {
          message: 'There was an error saving your schedule',
        });
      } else {
        toast.success('Schedule saved successfully!');
        // Mark form as pristine with current values
        form.reset(values);
      }
    } catch {
      toast.error('An unexpected error occurred');
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="relative pb-10">
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
              <div>
                <h3
                  id="weekly-hours"
                  className="font-regular font-serif text-xl tracking-tight text-eleva-primary"
                >
                  Weekly hours
                </h3>
                <p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
                  Configure times when you are available for bookings.
                </p>
              </div>

              <div className="lg:col-span-2">
                <div className="divide-y divide-eleva-neutral-200 rounded-lg border border-eleva-neutral-200">
                  {DAYS_OF_WEEK_IN_ORDER.map((dayOfWeek) => {
                    const dayFields = groupedAvailabilityFields[dayOfWeek] ?? [];
                    const hasAvailability = dayFields.length > 0;
                    return (
                      <div
                        key={dayOfWeek}
                        className="flex items-start gap-4 px-4 py-4 first:pt-4 last:pb-4"
                      >
                        <div className="w-40">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={hasAvailability}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  addAvailability({
                                    dayOfWeek,
                                    startTime: '09:00',
                                    endTime: '17:00',
                                  });
                                } else {
                                  for (const field of dayFields) {
                                    removeAvailability(field.index);
                                  }
                                }
                              }}
                            />
                            <span className="text-sm font-medium capitalize text-eleva-neutral-900">
                              {dayOfWeek}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1">
                          {hasAvailability ? (
                            <div className="space-y-3">
                              {dayFields.map((field, labelIndex) => (
                                <div key={field.id} className="group flex items-center gap-3">
                                  <FormField
                                    control={form.control}
                                    name={`availabilities.${field.index}.startTime`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                          >
                                            <SelectTrigger className="w-32 rounded border-eleva-neutral-200 font-mono text-sm">
                                              <SelectValue placeholder="Start time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TIME_OPTIONS.map((option) => (
                                                <SelectItem
                                                  key={option.value}
                                                  value={option.value}
                                                  className="font-mono text-sm"
                                                >
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </FormControl>
                                        <FormMessage className="text-xs text-eleva-highlight-red" />
                                      </FormItem>
                                    )}
                                  />
                                  <span className="text-xs text-eleva-neutral-900/60">to</span>
                                  <FormField
                                    control={form.control}
                                    name={`availabilities.${field.index}.endTime`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                          >
                                            <SelectTrigger className="w-32 rounded border-eleva-neutral-200 font-mono text-sm">
                                              <SelectValue placeholder="End time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TIME_OPTIONS.map((option) => (
                                                <SelectItem
                                                  key={option.value}
                                                  value={option.value}
                                                  className="font-mono text-sm"
                                                >
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </FormControl>
                                        <FormMessage className="text-xs text-eleva-highlight-red" />
                                      </FormItem>
                                    )}
                                  />
                                  <div className="flex items-center gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full text-eleva-neutral-900/60 opacity-0 transition-opacity hover:bg-eleva-highlight-red/10 hover:text-eleva-highlight-red group-hover:opacity-100"
                                            onClick={() => removeAvailability(field.index)}
                                          >
                                            <Trash2 className="size-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Remove time slot</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {labelIndex === dayFields.length - 1 && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="rounded-full text-eleva-neutral-900/60 opacity-0 transition-opacity hover:bg-eleva-primary/10 hover:text-eleva-primary group-hover:opacity-100"
                                              onClick={() => {
                                                addAvailability({
                                                  dayOfWeek,
                                                  startTime: '09:00',
                                                  endTime: '17:00',
                                                });
                                              }}
                                            >
                                              <Plus className="size-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Add time slot</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-eleva-neutral-900/60">Unavailable</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Separator className="my-8 bg-eleva-neutral-200" />

            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
              <div>
                <h3
                  id="timezone"
                  className="font-regular font-serif text-xl tracking-tight text-eleva-primary"
                >
                  Time zone
                </h3>
                <p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
                  Select your timezone to ensure accurate scheduling.
                </p>
              </div>

              <div className="lg:col-span-2">
                <div className="rounded-lg">
                  <TimezoneSelect control={form.control} name="timezone" />
                </div>
              </div>
            </div>

            <Separator className="my-8 bg-eleva-neutral-200" />

            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
              <div>
                <h3
                  id="blocked-dates"
                  className="font-regular font-serif text-xl tracking-tight text-eleva-primary"
                >
                  Block out dates
                </h3>
                <p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
                  Add days when you do not want to get bookings.
                </p>
              </div>

              <div className="lg:col-span-2">
                <BlockedDates
                  blockedDates={blockedDates}
                  onAddBlockedDates={handleAddBlockedDates}
                  onRemoveBlockedDate={handleRemoveBlockedDate}
                  onEditBlockedDate={handleEditBlockedDate}
                />
              </div>
            </div>
          </div>

          {/* Save Button - Clean primary style */}
          {form.formState.isDirty && (
            <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 right-6 z-10">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className={cn(
                  'px-6 py-2.5 font-medium shadow-lg transition-all',
                  'bg-eleva-primary text-white hover:bg-eleva-primary/90',
                  'focus:ring-2 focus:ring-eleva-primary/50 focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'rounded-full',
                )}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </>
  );
}
