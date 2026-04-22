/**
 * Zod Validation Schemas for Stripe Pricing Management
 *
 * Type-safe schemas for admin pricing operations
 */
import { z } from 'zod';

/**
 * Billing interval options for recurring prices
 */
export const billingIntervalSchema = z.enum(['day', 'week', 'month', 'year']);

/**
 * Price tier types (Community, Top, Partner, etc.)
 */
export const priceTierSchema = z.enum(['community', 'top', 'lecturer', 'partner']);

/**
 * Plan type (annual, monthly, commission-only)
 */
export const planTypeSchema = z.enum(['annual', 'monthly', 'commission']);

/**
 * Schema for creating a new Stripe Price
 */
export const createPriceSchema = z.object({
  productId: z
    .string()
    .min(1, 'Product is required')
    .startsWith('prod_', 'Invalid Stripe product ID'),

  // Price details
  unitAmount: z
    .number()
    .int('Amount must be an integer')
    .min(0, 'Amount must be positive')
    .max(999999999, 'Amount is too large'),

  currency: z.string().length(3, 'Currency must be 3 characters').toLowerCase(),

  // Recurring billing
  recurring: z
    .object({
      interval: billingIntervalSchema,
      intervalCount: z.number().int().min(1).max(12),
    })
    .optional(),

  // Metadata
  nickname: z.string().min(1, 'Nickname is required').max(100),

  tier: priceTierSchema.optional(),

  planType: planTypeSchema.optional(),

  commissionRate: z
    .number()
    .int('Commission rate must be an integer (basis points)')
    .min(0, 'Commission rate must be 0 or greater')
    .max(10000, 'Commission rate cannot exceed 10000 (100%)')
    .optional()
    .describe('Commission rate in basis points (e.g., 1200 = 12%)'),

  lookupKey: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Lookup key can only contain letters, numbers, hyphens, and underscores',
    )
    .optional()
    .describe('Unique lookup key for easy price retrieval'),

  active: z.boolean(),
});

export type CreatePriceInput = z.infer<typeof createPriceSchema>;

/**
 * Schema for updating a price (limited fields)
 */
export const updatePriceSchema = z.object({
  priceId: z
    .string()
    .min(1, 'Price ID is required')
    .startsWith('price_', 'Invalid Stripe price ID'),

  active: z.boolean().optional(),

  nickname: z.string().min(1).max(100).optional(),

  lookupKey: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Lookup key can only contain letters, numbers, hyphens, and underscores',
    )
    .optional(),

  metadata: z.record(z.string(), z.string()).optional(),
});

export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;

/**
 * Schema for filtering prices
 */
export const priceFilterSchema = z.object({
  productId: z.string().startsWith('prod_').optional(),
  active: z.boolean().optional(),
  tier: priceTierSchema.optional(),
  planType: planTypeSchema.optional(),
  currency: z.string().length(3).toLowerCase().optional(),
  recurring: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PriceFilterInput = z.infer<typeof priceFilterSchema>;

/**
 * Helper to convert unit amount to display format
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

/**
 * Helper to convert display format to unit amount (cents)
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Helper to format commission rate from basis points to percentage
 */
export function formatCommissionRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

/**
 * Helper to convert percentage to basis points
 */
export function parseCommissionRate(percentage: string): number {
  const cleaned = percentage.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100);
}
