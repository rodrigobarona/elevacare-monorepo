/**
 * Payment Transfer Status Constants
 *
 * This file centralizes all payment transfer status values used throughout the application.
 * Use these constants instead of hardcoded strings to ensure consistency with the database schema.
 */

// Individual Payment Transfer Status Values
export const PAYMENT_TRANSFER_STATUS_PENDING = 'PENDING' as const;
export const PAYMENT_TRANSFER_STATUS_APPROVED = 'APPROVED' as const;
export const PAYMENT_TRANSFER_STATUS_READY = 'READY' as const;
export const PAYMENT_TRANSFER_STATUS_COMPLETED = 'COMPLETED' as const;
export const PAYMENT_TRANSFER_STATUS_FAILED = 'FAILED' as const;
export const PAYMENT_TRANSFER_STATUS_REFUNDED = 'REFUNDED' as const;
export const PAYMENT_TRANSFER_STATUS_DISPUTED = 'DISPUTED' as const;
export const PAYMENT_TRANSFER_STATUS_PAID_OUT = 'PAID_OUT' as const;

// Complete list of payment transfer statuses
export const PAYMENT_TRANSFER_STATUSES = [
  PAYMENT_TRANSFER_STATUS_PENDING,
  PAYMENT_TRANSFER_STATUS_APPROVED,
  PAYMENT_TRANSFER_STATUS_READY,
  PAYMENT_TRANSFER_STATUS_COMPLETED,
  PAYMENT_TRANSFER_STATUS_FAILED,
  PAYMENT_TRANSFER_STATUS_REFUNDED,
  PAYMENT_TRANSFER_STATUS_DISPUTED,
  PAYMENT_TRANSFER_STATUS_PAID_OUT,
] as const;

// Type for payment transfer status (derived from the constant array)
export type PaymentTransferStatus = (typeof PAYMENT_TRANSFER_STATUSES)[number];

// Status groupings for common use cases
export const ACTIVE_PAYMENT_TRANSFER_STATUSES = [
  PAYMENT_TRANSFER_STATUS_PENDING,
  PAYMENT_TRANSFER_STATUS_APPROVED,
  PAYMENT_TRANSFER_STATUS_READY,
] as const;

export const COMPLETED_PAYMENT_TRANSFER_STATUSES = [
  PAYMENT_TRANSFER_STATUS_COMPLETED,
  PAYMENT_TRANSFER_STATUS_REFUNDED,
] as const;

export const FAILED_PAYMENT_TRANSFER_STATUSES = [
  PAYMENT_TRANSFER_STATUS_FAILED,
  PAYMENT_TRANSFER_STATUS_DISPUTED,
] as const;
