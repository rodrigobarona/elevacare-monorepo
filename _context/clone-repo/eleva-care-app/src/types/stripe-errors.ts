/**
 * Type definitions for Stripe API error responses
 * Used for consistent error handling across the application
 */

/**
 * Interface for Stripe errors based on Stripe SDK
 * This provides a consistent type for handling Stripe API errors
 */
export interface StripeError {
  type: string;
  message?: string;
  raw?: {
    code?: string;
    param?: string;
    message?: string;
    type?: string;
    doc_url?: string;
    decline_code?: string;
    statusCode?: number;
    requestId?: string;
  };
  code?: string;
  statusCode?: number;
  requestId?: string;
  doc_url?: string;
  param?: string;
  detail?: string;
  headers?: { [header: string]: string };
}

/**
 * Type guard to check if an error is a StripeError
 * @param error Any error object to check
 * @returns Boolean indicating if error matches StripeError shape
 */
export function isStripeError(error: unknown): error is StripeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof (error as StripeError).type === 'string'
  );
}
