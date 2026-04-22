import { vi } from 'vitest';

export async function triggerNovuWorkflow(): Promise<{ success: true }> {
  return { success: true };
}

export const buildNovuSubscriberFromStripe = vi.fn().mockReturnValue({
  subscriberId: 'cus_test123',
  email: 'customer@example.com',
  firstName: 'Test',
  lastName: 'Customer',
  locale: 'en',
  data: {
    stripeCustomerId: 'cus_test123',
    hasCustomerMetadata: false,
  },
});

export const STRIPE_EVENT_TO_WORKFLOW_MAPPINGS = {
  'payment_intent.succeeded': 'payment-universal',
  'payment_intent.payment_failed': 'payment-universal',
  'charge.refunded': 'payment-universal',
  'customer.subscription.created': 'payment-universal',
  'customer.subscription.updated': 'payment-universal',
  'customer.subscription.deleted': 'payment-universal',
  'invoice.payment_succeeded': 'payment-universal',
  'invoice.payment_failed': 'payment-universal',
  'charge.dispute.created': 'payment-universal',
  'account.updated': 'expert-management',
  'capability.updated': 'expert-management',
} as const;

export const getWorkflowFromStripeEvent = vi.fn().mockReturnValue('payment-universal');
