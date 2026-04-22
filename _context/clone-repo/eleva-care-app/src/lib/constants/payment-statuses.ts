/**
 * Payment Status Constants
 *
 * This file centralizes all payment status values used throughout the application
 * to ensure consistency with the database schema and Stripe integration.
 */

// Database Payment Status Constants (from MeetingsTable schema)
export const PAYMENT_STATUS_PENDING = 'pending' as const;
export const PAYMENT_STATUS_PROCESSING = 'processing' as const;
export const PAYMENT_STATUS_SUCCEEDED = 'succeeded' as const;
export const PAYMENT_STATUS_FAILED = 'failed' as const;
export const PAYMENT_STATUS_REFUNDED = 'refunded' as const;

// Complete list of valid payment statuses for the database
export const VALID_PAYMENT_STATUSES = [
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_PROCESSING,
  PAYMENT_STATUS_SUCCEEDED,
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_REFUNDED,
] as const;

// Type for payment status (derived from the constant array)
export type PaymentStatus = (typeof VALID_PAYMENT_STATUSES)[number];

// Stripe Payment Status Constants (known Stripe checkout session payment_status values)
export const STRIPE_PAYMENT_STATUS_PAID = 'paid' as const;
export const STRIPE_PAYMENT_STATUS_UNPAID = 'unpaid' as const;
export const STRIPE_PAYMENT_STATUS_NO_PAYMENT_REQUIRED = 'no_payment_required' as const;

// Helper function to validate if a status is a valid database payment status
export function isValidPaymentStatus(status: string): status is PaymentStatus {
  return VALID_PAYMENT_STATUSES.includes(status as PaymentStatus);
}
