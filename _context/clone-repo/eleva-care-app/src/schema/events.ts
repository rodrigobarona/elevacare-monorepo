import { slugSchema } from '@/lib/validations/slug';
import { z } from 'zod';

export const eventFormSchema = z.object({
  name: z.string().min(1, 'Required'),
  slug: slugSchema,
  description: z.string().optional(),
  isActive: z.boolean(),
  durationInMinutes: z
    .number()
    .int()
    .positive('Duration must be greater than 0')
    .max(60 * 12, `Duration must be less than 12 hours (${60 * 12} minutes)`),
  price: z.number().min(0, 'Price must be 0 or greater'),
  currency: z.literal('eur'),
  stripeProductId: z.string().optional(),
  stripePriceId: z.string().optional(),
});
