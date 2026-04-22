'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { slugify } from '@/lib/validations/slug';
import { eventFormSchema } from '@/schema/events';
import {
  createEvent,
  deleteEvent,
  getEventMeetingsCount,
  updateEvent,
} from '@/server/actions/events';
import { createStripeProduct, updateStripeProduct } from '@/server/actions/stripe';
import { useUsername } from '@/hooks/use-user-profile';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

// Dynamic import of RichTextEditor with SSR disabled
const RichTextEditor = dynamic(() => import('@/components/shared/rich-text/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100px] animate-pulse rounded-md border bg-muted/50 px-3 py-2" />
  ),
});

export function EventForm({
  event,
}: {
  event?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    durationInMinutes: number;
    isActive: boolean;
    price: number;
    stripeProductId?: string;
    stripePriceId?: string;
  };
}) {
  const { user } = useAuth(); // Still need user.id for workosUserId
  const router = useRouter();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isStripeProcessing, setIsStripeProcessing] = React.useState(false);
  const [meetingsCount, setMeetingsCount] = React.useState<number>(0);
  const { username } = useUsername(); // Centralized hook with caching

  const form = useForm<z.infer<typeof eventFormSchema>>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: event ?? {
      isActive: true,
      durationInMinutes: 30,
      price: 0,
      currency: 'eur',
      name: '',
      slug: '',
    },
  });

  const [description, setDescription] = React.useState(event?.description || '');

  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'name') {
        form.setValue('slug', slugify(value.name as string), {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  React.useEffect(() => {
    if (event?.id) {
      getEventMeetingsCount(event.id).then(setMeetingsCount);
    }
  }, [event?.id]);

  const onSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    form.setValue('slug', currentValue, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const onSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ') {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      const newValue = `${input.value}-`;
      form.setValue('slug', newValue, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = newValue.length;
      }, 0);
    }
  };

  const handleSubmit = async (values: z.infer<typeof eventFormSchema>) => {
    try {
      setIsStripeProcessing(true);

      // First handle Stripe if price > 0
      let stripeData = null;
      if (values.price > 0) {
        if (!event?.stripeProductId) {
          stripeData = await createStripeProduct({
            name: values.name,
            description: values.description || undefined,
            price: values.price,
            currency: values.currency,
            workosUserId: user?.id || '',
          });
        } else if (event.stripeProductId && event.stripePriceId) {
          stripeData = await updateStripeProduct({
            stripeProductId: event.stripeProductId,
            stripePriceId: event.stripePriceId,
            name: values.name,
            description: values.description || undefined,
            price: values.price,
            currency: values.currency,
            workosUserId: user?.id || '',
          });
        } else {
          form.setError('root', {
            message: 'Invalid Stripe product configuration',
          });
          return;
        }

        if (stripeData?.error) {
          form.setError('root', {
            message: `Failed to sync with Stripe: ${stripeData.error}`,
          });
          return;
        }
      }

      // Then create/update the event
      const action = event == null ? createEvent : updateEvent.bind(null, event.id);
      const eventData = await action({
        ...values,
        stripeProductId: stripeData?.productId || event?.stripeProductId,
        stripePriceId: stripeData?.priceId || event?.stripePriceId,
      });

      if (eventData?.error) {
        form.setError('root', {
          message: 'Failed to save event',
        });
        return;
      }

      // Use router.push for navigation
      router.push('/booking/events');
    } catch (error) {
      console.error('Form submission error:', error);
      form.setError('root', {
        message: 'An unexpected error occurred',
      });
    } finally {
      setIsStripeProcessing(false);
    }
  };

  // Update the price field to show loading state when processing Stripe
  const PriceField = () => (
    <FormField
      control={form.control}
      name="price"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Price</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input
                type="number"
                min="0"
                step="0.50"
                {...field}
                disabled={isStripeProcessing}
                onChange={(e) => {
                  const value = Number.parseFloat(e.target.value || '0');
                  // Round to nearest 0.50
                  const roundedValue = Math.round(value * 2) / 2;
                  field.onChange(Math.round(roundedValue * 100));
                }}
                value={field.value ? field.value / 100 : 0}
                className="w-32"
              />
            </FormControl>
            <span className="text-muted-foreground">EUR</span>
            {isStripeProcessing && (
              <span className="text-sm text-muted-foreground">Syncing with Stripe...</span>
            )}
          </div>
          <FormDescription>
            {event?.stripeProductId ? (
              <span>Connected to Stripe Product: {event.stripeProductId.slice(0, 8)}...</span>
            ) : (
              'Set to 0 for free events. Price in euros.'
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {form.formState.errors.root && (
          <div className="text-sm text-destructive">{form.formState.errors.root.message}</div>
        )}

        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border p-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>The name users will see when booking</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      variant="simple"
                      value={description}
                      onChange={(value) => {
                        setDescription(value);
                        field.onChange(value);
                      }}
                      placeholder="Describe your event. You can use formatting to make it more readable."
                      features={{
                        images: false,
                        tables: false,
                        colors: false,
                        alignment: true,
                        typography: true,
                        links: true,
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe your event. You can use formatting to make it more readable.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <div className="flex w-full items-center overflow-hidden rounded-md border">
                    <div className="flex h-full items-center bg-muted px-3 py-2 text-sm text-muted-foreground">
                      eleva.care/{username || 'username'}/
                    </div>
                    <div className="w-px self-stretch bg-border" />
                    <FormControl>
                      <Input
                        {...field}
                        onChange={onSlugChange}
                        onKeyDown={onSlugKeyDown}
                        className="flex-1 border-0 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="event-name"
                      />
                    </FormControl>
                  </div>
                  <FormDescription>URL-friendly version of the event name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <FormField
              control={form.control}
              name="durationInMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    defaultValue={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="10">10 minutes session</SelectItem>
                      <SelectItem value="30">30 minutes session</SelectItem>
                      <SelectItem value="45">45 minutes session</SelectItem>
                      <SelectItem value="60">60 minutes session</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the appropriate session duration</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="mt-0!">Active</FormLabel>
                  </div>
                  <FormDescription>
                    Inactive events will not be visible for users to book
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <PriceField />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {event && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructiveGhost"
                  disabled={isDeletePending || form.formState.isSubmitting}
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <span className="block space-y-2">
                      <span className="block">
                        This action cannot be undone. This will permanently delete your event
                        {meetingsCount > 0
                          ? ` and ${meetingsCount} associated meeting${meetingsCount === 1 ? '' : 's'}`
                          : ''}
                        .
                      </span>
                      {meetingsCount > 0 && (
                        <span className="block font-medium text-destructive">
                          Warning: All associated meetings will also be deleted!
                        </span>
                      )}
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isDeletePending || form.formState.isSubmitting}
                    variant="destructive"
                    onClick={() => {
                      const promise = new Promise((resolve, reject) => {
                        startDeleteTransition(async () => {
                          try {
                            const data = await deleteEvent(event.id);
                            if (data?.error) {
                              reject(new Error('Failed to delete event'));
                            } else {
                              resolve(true);
                              router.push('/booking/events');
                            }
                          } catch (error) {
                            reject(error);
                          }
                        });
                      });

                      toast.promise(promise, {
                        loading: 'Deleting event...',
                        success: 'Event deleted successfully',
                        error: 'Failed to delete event',
                      });
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            type="button"
            asChild
            variant="outline"
            disabled={isStripeProcessing || form.formState.isSubmitting}
          >
            <Link href="/events">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isStripeProcessing || form.formState.isSubmitting}>
            {isStripeProcessing ? 'Processing...' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
