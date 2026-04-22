/**
 * Stripe Integration Module
 *
 * Unified interface for Stripe operations including payments, Connect accounts,
 * and Identity verification.
 *
 * @example
 * ```typescript
 * import { stripeClient, syncStripeDataToKV } from '@/lib/integrations/stripe';
 * ```
 */

export * from './client';
export * from './identity';
export * from './transfer-utils';
