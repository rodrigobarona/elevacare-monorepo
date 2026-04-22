/**
 * Novu Integration Module
 *
 * Provides a unified interface for Novu notifications, email service,
 * and workflow triggers.
 *
 * @example
 * ```typescript
 * import { triggerWorkflow, updateSubscriber } from '@/lib/integrations/novu';
 *
 * await triggerWorkflow({
 *   workflowId: 'booking-confirmation',
 *   to: { subscriberId: 'user_123', email: 'user@example.com' },
 *   payload: { appointmentDate: '2024-01-15' },
 * });
 * ```
 */

export * from './email-service';

export {
  triggerWorkflow,
  triggerNovuWorkflow,
  updateSubscriber,
  transformStripePayloadForNovu,
  getNovuStatus,
  runNovuDiagnostics,
  novu,
  buildNovuSubscriberFromStripe,
  getWorkflowFromStripeEvent,
  STRIPE_EVENT_TO_WORKFLOW_MAPPINGS,
} from './utils';

export type { StripeWebhookPayload, TriggerWorkflowOptions } from './utils';
