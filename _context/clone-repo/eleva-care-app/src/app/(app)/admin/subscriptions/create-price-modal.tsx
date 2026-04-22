'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { type CreatePriceInput, createPriceSchema } from '@/lib/validations/stripe-pricing';
import { createStripePrice } from '@/server/actions/stripe-pricing';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type Stripe from 'stripe';

interface CreatePriceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Stripe.Product;
}

export function CreatePriceModal({ open, onOpenChange, product }: CreatePriceModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);

  const form = useForm<CreatePriceInput>({
    resolver: zodResolver(createPriceSchema),
    defaultValues: {
      productId: product.id,
      currency: 'usd',
      recurring: {
        interval: 'month',
        intervalCount: 1,
      },
      active: true,
    },
  });

  const onSubmit = async (data: CreatePriceInput) => {
    setIsSubmitting(true);

    // Parse currency string to cents
    const amountInCents = data.unitAmount;

    const payload: CreatePriceInput = {
      ...data,
      unitAmount: amountInCents,
      recurring: isRecurring ? data.recurring : undefined,
    };

    const result = await createStripePrice(payload);

    if (result.success) {
      toast.success(result.message);
      form.reset();
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to create price');
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Price</DialogTitle>
          <DialogDescription>
            Add a new price for <strong>{product.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Nickname */}
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Community Expert - Monthly" {...field} />
                  </FormControl>
                  <FormDescription>A descriptive name for this price</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="unitAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (in cents) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="4900"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Amount in cents (e.g., 4900 = $49.00)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="usd">USD</SelectItem>
                        <SelectItem value="eur">EUR</SelectItem>
                        <SelectItem value="gbp">GBP</SelectItem>
                        <SelectItem value="cad">CAD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Recurring Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
              />
              <label
                htmlFor="recurring"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recurring subscription
              </label>
            </div>

            {/* Recurring Details */}
            {isRecurring && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="recurring.interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Interval *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select interval" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="day">Daily</SelectItem>
                          <SelectItem value="week">Weekly</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recurring.intervalCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interval Count *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormDescription>Bill every N intervals</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Metadata (Optional)</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="community">Community</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="lecturer">Lecturer</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="planType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select plan type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="commission">Commission-Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="commissionRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Rate (basis points)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1200"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Commission in basis points (e.g., 1200 = 12%, 800 = 8%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lookupKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lookup Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="community-expert-monthly"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique key for easy retrieval (e.g., community-expert-monthly)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Price
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
