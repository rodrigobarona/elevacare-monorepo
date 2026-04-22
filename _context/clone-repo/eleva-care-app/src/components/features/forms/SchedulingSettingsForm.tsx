'use client';

/**
 * SchedulingSettingsForm Component
 *
 * A form for managing scheduling settings like buffer times, minimum notice, and time slot intervals.
 * Similar to Cal.com's approach to managing availability and scheduling.
 */
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DEFAULT_SCHEDULING_SETTINGS } from '@/lib/constants/scheduling';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

// Define schema for scheduling settings form
const formSchema = z.object({
  beforeEventBuffer: z
    .number()
    .min(0, 'Buffer time cannot be negative')
    .max(120, 'Buffer time cannot exceed 2 hours'),
  afterEventBuffer: z
    .number()
    .min(0, 'Buffer time cannot be negative')
    .max(120, 'Buffer time cannot exceed 2 hours'),
  minimumNotice: z
    .number()
    .min(60, 'Minimum notice must be at least 1 hour')
    .max(20160, 'Minimum notice cannot exceed 2 weeks')
    .refine(
      (val) => MINIMUM_NOTICE_OPTIONS.some((option) => option.value === val),
      'Please select a valid minimum notice period',
    ),
  timeSlotInterval: z
    .number()
    .refine((val) => val % 5 === 0, 'Time slot interval must be in 5-minute increments')
    .refine((val) => val >= 5, 'Time slot interval must be at least 5 minutes')
    .refine((val) => val <= 120, 'Time slot interval cannot exceed 2 hours'),
  bookingWindowDays: z
    .number()
    .min(7, 'Booking window must be at least 1 week')
    .max(365, 'Booking window cannot exceed 1 year'),
});

type FormValues = z.infer<typeof formSchema>;

// Time slot interval options
const TIME_SLOT_INTERVALS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
];

// Replace BOOKING_WINDOW_OPTIONS with the new options including weeks
const BOOKING_WINDOW_OPTIONS = [
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

// Add this constant near the other options constants
const MINIMUM_NOTICE_OPTIONS = [
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' }, // 1 day (default)
  { value: 2880, label: '2 days' },
  { value: 4320, label: '3 days' },
  { value: 7200, label: '5 days' },
  { value: 10080, label: '1 week' },
  { value: 20160, label: '2 weeks' },
];

// Buffer time options in minutes
const BUFFER_TIME_OPTIONS = [
  { value: 0, label: 'No buffer' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

// Default values imported from shared constants
const DEFAULT_VALUES: FormValues = DEFAULT_SCHEDULING_SETTINGS;

export function SchedulingSettingsForm() {
  const [isLoading, setIsLoading] = useState(true);

  // Initialize form with react-hook-form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

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

  // Fetch current settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/scheduling-settings');

        if (!response.ok) {
          throw new Error('Failed to fetch scheduling settings');
        }

        const settings = await response.json();

        // Update form with fetched settings
        form.reset(settings);
      } catch (error) {
        console.error('Error fetching scheduling settings:', error);
        toast.error('Failed to load scheduling settings. Using default values.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [form]);

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/scheduling-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to update scheduling settings');
      }

      toast.success('Scheduling settings updated successfully.');
      // Mark form as pristine with current values
      form.reset(values);
    } catch (error) {
      console.error('Error updating scheduling settings:', error);
      toast.error('Failed to update scheduling settings.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
          <div className="space-y-1">
            <h3
              id="buffer-times"
              className="font-regular font-serif text-xl tracking-tight text-eleva-primary"
            >
              Buffer Times
            </h3>
            <p className="text-sm leading-6 text-eleva-neutral-900/70">
              Add padding before and after events to prepare or wrap up.
            </p>
          </div>

          <div className="lg:col-span-2">
            <div className="">
              <FormField
                control={form.control}
                name="beforeEventBuffer"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-eleva-neutral-900">
                        Buffer before events
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6">
                              <Info className="size-4 text-eleva-neutral-900/60" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-eleva-primary px-3 py-1.5 text-xs text-white">
                            Add padding time before events to prepare and avoid back-to-back
                            meetings
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
                        value={field.value.toString()}
                      >
                        <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                          <SelectValue placeholder="Select buffer time" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUFFER_TIME_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                              className="cursor-pointer"
                            >
                              <span className="font-mono text-sm">{option.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-xs text-eleva-neutral-900/60">
                      Time blocked before each event starts
                    </FormDescription>
                    <FormMessage className="text-xs text-eleva-highlight-red" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="afterEventBuffer"
                render={({ field }) => (
                  <FormItem className="space-y-2 pt-6">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-eleva-neutral-900">
                        Buffer after events
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6">
                              <Info className="size-4 text-eleva-neutral-900/60" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-eleva-primary px-3 py-1.5 text-xs text-white">
                            Add padding time after events for notes and wrap-up tasks
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
                        value={field.value.toString()}
                      >
                        <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                          <SelectValue placeholder="Select buffer time" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUFFER_TIME_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                              className="cursor-pointer"
                            >
                              <span className="font-mono text-sm">{option.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-xs text-eleva-neutral-900/60">
                      Time blocked after each event ends
                    </FormDescription>
                    <FormMessage className="text-xs text-eleva-highlight-red" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator className="bg-eleva-neutral-200" />

        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
          <div className="space-y-1">
            <h3
              id="booking-rules"
              className="font-regular font-serif text-xl tracking-tight text-eleva-primary"
            >
              Booking Rules
            </h3>
            <p className="text-sm leading-6 text-eleva-neutral-900/70">
              Configure advance notice requirements and scheduling intervals.
            </p>
          </div>

          <div className="lg:col-span-2">
            <div className="">
              <FormField
                control={form.control}
                name="minimumNotice"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-eleva-neutral-900">
                        Minimum notice period
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6">
                              <Info className="size-4 text-eleva-neutral-900/60" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-eleva-primary px-3 py-1.5 text-xs text-white">
                            The minimum time required before someone can book an appointment
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
                        value={field.value.toString()}
                      >
                        <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                          <SelectValue placeholder="Select notice period" />
                        </SelectTrigger>
                        <SelectContent>
                          {MINIMUM_NOTICE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                              className="cursor-pointer"
                            >
                              <span className="font-mono text-sm">{option.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-xs text-eleva-neutral-900/60">
                      Required advance notice for new bookings
                    </FormDescription>
                    <FormMessage className="text-xs text-eleva-highlight-red" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeSlotInterval"
                render={({ field }) => (
                  <FormItem className="space-y-2 pt-6">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-eleva-neutral-900">
                        Time slot duration
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6">
                              <Info className="size-4 text-eleva-neutral-900/60" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-eleva-primary px-3 py-1.5 text-xs text-white">
                            Determines how finely you can schedule appointments
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
                        value={field.value.toString()}
                      >
                        <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                          <SelectValue placeholder="Select time slot length" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOT_INTERVALS.map((interval) => (
                            <SelectItem
                              key={interval.value}
                              value={interval.value.toString()}
                              className="cursor-pointer"
                            >
                              <span className="font-mono text-sm">{interval.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-xs text-eleva-neutral-900/60">
                      Length of each bookable time slot
                    </FormDescription>
                    <FormMessage className="text-xs text-eleva-highlight-red" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator className="bg-eleva-neutral-200" />

        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
          <div className="space-y-1">
            <h3
              id="booking-window"
              className="font-regular font-serif text-xl tracking-tight text-eleva-primary"
            >
              Booking Window
            </h3>
            <p className="text-sm leading-6 text-eleva-neutral-900/70">
              Control how far in advance people can schedule appointments.
            </p>
          </div>

          <div className="lg:col-span-2">
            <div className="">
              <FormField
                control={form.control}
                name="bookingWindowDays"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-eleva-neutral-900">
                        Maximum booking period
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6">
                              <Info className="size-4 text-eleva-neutral-900/60" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-eleva-primary px-3 py-1.5 text-xs text-white">
                            The furthest in the future that appointments can be scheduled
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
                        value={field.value.toString()}
                      >
                        <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                          <SelectValue placeholder="Select booking period" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOKING_WINDOW_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                              className="cursor-pointer"
                            >
                              <span className="font-mono text-sm">{option.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-xs text-eleva-neutral-900/60">
                      How far ahead appointments can be booked
                    </FormDescription>
                    <FormMessage className="text-xs text-eleva-highlight-red" />
                  </FormItem>
                )}
              />
            </div>

            {/* Save Button - Clean primary style */}
            {form.formState.isDirty && (
              <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 right-6 z-10">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'px-6 py-2.5 font-medium shadow-lg transition-all',
                    'bg-eleva-primary text-white hover:bg-eleva-primary/90',
                    'focus:ring-2 focus:ring-eleva-primary/50 focus:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'rounded-full',
                  )}
                >
                  {isLoading ? (
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
          </div>
        </div>
      </form>
    </Form>
  );
}
