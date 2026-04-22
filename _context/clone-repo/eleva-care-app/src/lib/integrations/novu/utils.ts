import * as Sentry from '@sentry/nextjs';
import { ENV_CONFIG } from '@/config/env';
import { Novu } from '@novu/api';
import { SubscriberPayloadDto } from '@novu/api/models/components/subscriberpayloaddto';

const { logger } = Sentry;

let novu: Novu | null = null;
let initializationError: string | null = null;

try {
  if (ENV_CONFIG.NOVU_SECRET_KEY) {
    novu = new Novu({
      secretKey: ENV_CONFIG.NOVU_SECRET_KEY,
      ...(ENV_CONFIG.NOVU_BASE_URL && { serverURL: ENV_CONFIG.NOVU_BASE_URL }),
    });
  } else {
    initializationError = 'Missing NOVU_SECRET_KEY environment variable';
  }
} catch (error) {
  initializationError = `Initialization failed: ${error}`;
  logger.error('Novu client initialization failed', { error: String(error) });
}

/**
 * Options for triggering a Novu workflow
 * Modern interface following latest documentation patterns
 */
export interface TriggerWorkflowOptions {
  workflowId: string;
  to: {
    subscriberId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    data?: Record<string, string | number | boolean>;
  };
  payload?: Record<string, unknown>;
  overrides?: {
    email?: {
      from?: string;
      subject?: string;
    };
    sms?: Record<string, unknown>;
    push?: Record<string, unknown>;
  };
  actor?: {
    subscriberId: string;
    data?: Record<string, string | number | boolean>;
  };
  /**
   * Unique transaction ID for idempotency - prevents duplicate notifications on retries.
   * MUST be deterministic (stable across retries) to work correctly.
   *
   * @example
   * ```typescript
   * // Good: Deterministic transactionId based on appointment and window
   * transactionId: `24h-expert-${appointment.id}`
   *
   * // Good: Include recipient type for different notifications
   * transactionId: `urgent-patient-${appointment.id}-1hr`
   *
   * // BAD: Non-deterministic - defeats idempotency purpose
   * transactionId: `24h-expert-${appointment.id}-${Date.now()}`
   * ```
   */
  transactionId?: string;
}

/**
 * Trigger a Novu workflow with subscriber and payload data (Legacy)
 * @param workflowId - The Novu workflow identifier
 * @param subscriber - Subscriber data for the notification target
 * @param payload - Custom payload data for the workflow
 * @returns Promise with success/error response
 *
 * @example
 * ```typescript
 * const result = await triggerNovuWorkflow(
 *   'welcome-email',
 *   { subscriberId: 'user_123', email: 'user@example.com', firstName: 'John' },
 *   { welcomeMessage: 'Hello!' }
 * );
 * if (result.success) console.log('Workflow triggered');
 * ```
 */
export async function triggerNovuWorkflow(
  workflowId: string,
  subscriber: SubscriberPayloadDto,
  payload: object,
) {
  if (!novu) {
    logger.error(logger.fmt`Cannot trigger workflow ${workflowId}: ${initializationError || 'client not initialized'}`);
    return { success: false, error: initializationError || 'Client not initialized' };
  }

  try {
    logger.debug(logger.fmt`Triggering workflow: ${workflowId}`, {
      subscriberId: subscriber.subscriberId,
      payloadKeys: Object.keys(payload).join(', '),
    });

    await novu.trigger({
      workflowId,
      to: subscriber,
      payload,
    });

    logger.info(logger.fmt`Successfully triggered workflow: ${workflowId}`);
    return { success: true };
  } catch (error) {
    logger.error(logger.fmt`Failed to trigger workflow: ${workflowId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    Sentry.captureException(error, { tags: { novu_workflow: workflowId } });
    return { success: false, error };
  }
}

/**
 * Trigger a Novu workflow using the latest API
 * This is the primary function for triggering workflows throughout the app.
 * Following @novu/api best practices from documentation
 *
 * @param options - Workflow trigger options including subscriber and payload
 * @returns Result object or null if failed
 *
 * @example
 * ```typescript
 * const result = await triggerWorkflow({
 *   workflowId: 'booking-confirmation',
 *   to: { subscriberId: 'user_123', email: 'user@example.com' },
 *   payload: { appointmentDate: '2024-01-15', expertName: 'Dr. Smith' },
 * });
 * ```
 */
export async function triggerWorkflow(options: TriggerWorkflowOptions) {
  if (!novu) {
    logger.error(logger.fmt`Cannot trigger workflow ${options.workflowId}: ${initializationError || 'client not initialized'}`);
    return null;
  }

  try {
    logger.debug(logger.fmt`Triggering workflow: ${options.workflowId}`, {
      subscriberId: options.to.subscriberId,
      hasPayload: !!options.payload,
    });

    const result = await novu.trigger({
      workflowId: options.workflowId,
      to: options.to,
      payload: options.payload || {},
      overrides: options.overrides,
      actor: options.actor,
      ...(options.transactionId && { transactionId: options.transactionId }),
    });

    logger.info(logger.fmt`Successfully triggered workflow: ${options.workflowId}`);
    return result;
  } catch (error) {
    logger.error(logger.fmt`Failed to trigger workflow ${options.workflowId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    Sentry.captureException(error, { tags: { novu_workflow: options.workflowId } });
    return null;
  }
}

/**
 * Create or update a subscriber using modern API
 * Synchronizes user profile data with Novu following best practices
 *
 * @param subscriber - Subscriber data to create or update
 * @returns Result object or null if failed
 *
 * @example
 * ```typescript
 * await updateSubscriber({
 *   subscriberId: 'user_123',
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 * ```
 */
export async function updateSubscriber(subscriber: TriggerWorkflowOptions['to']) {
  if (!novu) {
    logger.warn('Cannot update subscriber: client not initialized');
    return null;
  }

  try {
    const result = await novu.subscribers.create({
      subscriberId: subscriber.subscriberId,
      firstName: subscriber.firstName,
      lastName: subscriber.lastName,
      email: subscriber.email,
      phone: subscriber.phone,
      avatar: subscriber.avatar,
      data: subscriber.data,
    });

    logger.debug(logger.fmt`Subscriber updated: ${subscriber.subscriberId}`);
    return result;
  } catch (error) {
    logger.error('Error updating subscriber', {
      subscriberId: subscriber.subscriberId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get Novu client status and configuration for diagnostics
 *
 * @returns Object containing initialization status and configuration details
 *
 * @example
 * ```typescript
 * const status = getNovuStatus();
 * if (!status.initialized) {
 *   console.error('Novu not initialized:', status.initializationError);
 * }
 * ```
 */
export function getNovuStatus() {
  return {
    initialized: !!novu,
    initializationError,
    config: {
      hasSecretKey: !!ENV_CONFIG.NOVU_SECRET_KEY,
      hasAppId: !!ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER,
      baseUrl: ENV_CONFIG.NOVU_BASE_URL,
      socketUrl: ENV_CONFIG.NOVU_SOCKET_URL,
      adminSubscriberId: ENV_CONFIG.NOVU_ADMIN_SUBSCRIBER_ID,
    },
  };
}

/**
 * Comprehensive Novu health monitoring and diagnostics
 * Use this function to diagnose Novu configuration issues
 *
 * @returns Diagnostics object with client status, workflows, errors, and recommendations
 *
 * @example
 * ```typescript
 * const diagnostics = await runNovuDiagnostics();
 * if (!diagnostics.summary.healthy) {
 *   console.error('Issues found:', diagnostics.errors);
 * }
 * ```
 */
export async function runNovuDiagnostics() {
  logger.info('Starting Novu diagnostics');

  const diagnostics = {
    client: getNovuStatus(),
    workflows: [] as Array<{ id: string; status: string; timestamp: string }>,
    errors: [] as string[],
    recommendations: [] as string[],
    summary: {
      healthy: true,
      criticalErrors: 0,
      warnings: 0,
    },
  };

  if (!diagnostics.client.initialized) {
    diagnostics.errors.push(`Client not initialized: ${diagnostics.client.initializationError}`);
    diagnostics.recommendations.push('Check NOVU_SECRET_KEY environment variable');
    diagnostics.summary.criticalErrors++;
  }

  const testWorkflowId = 'system-health';
  const testSubscriber = {
    subscriberId: ENV_CONFIG.NOVU_ADMIN_SUBSCRIBER_ID || 'test-admin',
    email: 'admin@eleva.care',
    firstName: 'System',
    lastName: 'Admin',
  };

  try {
    const testPayload = {
      eventType: 'health-check-diagnostics',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: ENV_CONFIG.NODE_ENV,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        percentage: Math.round(
          (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        ),
      },
    };

    const result = await triggerWorkflow({
      workflowId: testWorkflowId,
      to: testSubscriber,
      payload: testPayload,
    });

    if (result) {
      diagnostics.workflows.push({
        id: testWorkflowId,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } else {
      diagnostics.errors.push('Test workflow trigger returned null');
      diagnostics.summary.criticalErrors++;
    }
  } catch (error) {
    diagnostics.errors.push(`Test workflow error: ${error}`);
    diagnostics.summary.criticalErrors++;
  }

  const envChecks = [
    { name: 'NOVU_SECRET_KEY', value: !!ENV_CONFIG.NOVU_SECRET_KEY, critical: true },
    {
      name: 'NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER',
      value: !!ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER,
      critical: true,
    },
    { name: 'NOVU_BASE_URL', value: !!ENV_CONFIG.NOVU_BASE_URL, critical: false },
    {
      name: 'NOVU_ADMIN_SUBSCRIBER_ID',
      value: !!ENV_CONFIG.NOVU_ADMIN_SUBSCRIBER_ID,
      critical: false,
    },
  ];

  envChecks.forEach((check) => {
    if (!check.value) {
      if (check.critical) {
        diagnostics.errors.push(`Missing critical environment variable: ${check.name}`);
        diagnostics.summary.criticalErrors++;
      } else {
        diagnostics.recommendations.push(`Consider setting ${check.name} for better functionality`);
        diagnostics.summary.warnings++;
      }
    }
  });

  const skipBridgeCheck = process.env.SKIP_NOVU_BRIDGE_CHECK === 'true';

  if (skipBridgeCheck) {
    diagnostics.recommendations.push(
      'Bridge endpoint check was skipped. Run with SKIP_NOVU_BRIDGE_CHECK=false to verify the /api/novu endpoint.',
    );
    diagnostics.summary.warnings++;
  } else {
    try {
      const baseUrl = ENV_CONFIG.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const bridgeUrl = `${baseUrl}/api/novu`;

      const bridgeResponse = await fetch(bridgeUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!bridgeResponse.ok) {
        diagnostics.recommendations.push('Check /api/novu bridge endpoint configuration');
        diagnostics.summary.warnings++;
      }
    } catch {
      diagnostics.recommendations.push(
        'Bridge endpoint check failed. Ensure the application is running before running diagnostics, or set SKIP_NOVU_BRIDGE_CHECK=true to skip this check.',
      );
      diagnostics.summary.warnings++;
    }
  }

  diagnostics.summary.healthy = diagnostics.summary.criticalErrors === 0;

  logger.info('Novu diagnostics complete', {
    healthy: diagnostics.summary.healthy,
    criticalErrors: diagnostics.summary.criticalErrors,
    warnings: diagnostics.summary.warnings,
  });

  return diagnostics;
}

export { novu };

interface StripeCustomer {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_locales?: string[] | null;
  metadata?: Record<string, string>;
}

/**
 * Build subscriber data from Stripe customer data
 * @param customer - Stripe customer object
 * @returns Formatted subscriber data for Novu
 */
export function buildNovuSubscriberFromStripe(customer: StripeCustomer): SubscriberPayloadDto {
  // Split the full name into first and last name
  const [firstName = '', lastName = ''] = (customer.name ?? '').split(' ');

  return {
    subscriberId: customer.id,
    email: customer.email ?? undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: customer.phone ?? undefined,
    locale: customer.preferred_locales?.[0] || 'en',
    avatar: undefined, // Stripe doesn't provide avatar
    data: {
      stripeCustomerId: customer.id,
      hasCustomerMetadata: Boolean(customer.metadata && Object.keys(customer.metadata).length > 0),
    },
  };
}

/**
 * Mapping of Stripe events to Novu workflow IDs
 * Updated to use standardized workflow IDs from config/novu-workflows.ts
 */
export const STRIPE_EVENT_TO_WORKFLOW_MAPPINGS = {
  // Payment events - use universal workflow with eventType
  'payment_intent.succeeded': 'payment-universal', // Uses eventType: 'success'
  'payment_intent.payment_failed': 'payment-universal', // Uses eventType: 'failed'
  'charge.refunded': 'payment-universal', // Uses eventType: 'refund'

  // Subscription events - use payment universal workflow
  'customer.subscription.created': 'payment-universal', // Uses eventType: 'success'
  'customer.subscription.updated': 'payment-universal', // Uses eventType: 'success'
  'customer.subscription.deleted': 'payment-universal', // Uses eventType: 'cancelled'

  // Invoice events - use payment universal workflow
  'invoice.payment_succeeded': 'payment-universal', // Uses eventType: 'success'
  'invoice.payment_failed': 'payment-universal', // Uses eventType: 'failed'

  // Dispute events - use payment universal workflow
  'charge.dispute.created': 'payment-universal', // Uses eventType: 'dispute'

  // Connect account events - use expert management workflow
  'account.updated': 'expert-management', // Uses eventType: 'connect-account-status'
  'capability.updated': 'expert-management', // Uses eventType: 'capability-updated'
} as const;

/**
 * Stripe event type → Novu payment-universal workflow eventType
 * Maps raw Stripe event types to the values expected by paymentWorkflow schema
 */
const STRIPE_TO_PAYMENT_EVENT_TYPE: Record<string, string> = {
  'payment_intent.succeeded': 'success',
  'payment_intent.payment_failed': 'failed',
  'charge.refunded': 'refunded',
  'checkout.session.completed': 'confirmed',
  'customer.subscription.created': 'confirmed',
  'customer.subscription.updated': 'confirmed',
  'customer.subscription.deleted': 'cancelled',
  'invoice.payment_succeeded': 'success',
  'invoice.payment_failed': 'failed',
  'charge.dispute.created': 'disputed',
};

/**
 * Stripe event type → Novu expert-management workflow notificationType
 * Maps raw Stripe event types to the values expected by expertManagementWorkflow schema
 */
const STRIPE_TO_EXPERT_NOTIFICATION_TYPE: Record<string, string> = {
  'account.updated': 'account-update',
  'capability.updated': 'account-update',
  'payout.paid': 'payout-processed',
  'payout.failed': 'account-update',
};

/**
 * Raw Stripe webhook payload structure
 * Used as input for transformStripePayloadForNovu
 */
export interface StripeWebhookPayload {
  eventType: string;
  eventId: string;
  eventData: Record<string, unknown>;
  timestamp: number;
  source: string;
  amount?: number;
  currency?: string;
}

/**
 * Transform raw Stripe webhook payload to Novu workflow-compatible format
 *
 * This function converts Stripe event data to match the expected schema
 * for each Novu workflow, handling:
 * - Event type mapping (e.g., 'payment_intent.succeeded' → 'success')
 * - Amount formatting (cents to formatted string: 7000 → "70.00")
 * - Required field extraction (customerName, expertName, etc.)
 *
 * @param workflowId - The target Novu workflow ID
 * @param stripePayload - Raw Stripe webhook payload
 * @param customer - Stripe customer object (for name/locale extraction)
 * @returns Transformed payload matching the target workflow schema
 *
 * @example
 * ```typescript
 * const payload = transformStripePayloadForNovu(
 *   'payment-universal',
 *   { eventType: 'payment_intent.succeeded', amount: 7000, ... },
 *   customer
 * );
 * // Returns: { eventType: 'success', amount: '70.00', customerName: 'John Doe', ... }
 * ```
 */
export function transformStripePayloadForNovu(
  workflowId: string,
  stripePayload: StripeWebhookPayload,
  customer: StripeCustomer | null,
): Record<string, unknown> {
  // Base payload with debugging info and locale
  const basePayload = {
    _stripeEventType: stripePayload.eventType,
    _stripeEventId: stripePayload.eventId,
    _timestamp: stripePayload.timestamp,
    locale: customer?.preferred_locales?.[0] || 'en',
  };

  switch (workflowId) {
    case 'payment-universal':
      return {
        ...basePayload,
        eventType: STRIPE_TO_PAYMENT_EVENT_TYPE[stripePayload.eventType] || 'pending',
        amount: ((stripePayload.amount || 0) / 100).toFixed(2),
        currency: (stripePayload.currency || 'eur').toUpperCase(),
        customerName: customer?.name || 'Customer',
        transactionId: String(stripePayload.eventData?.id || stripePayload.eventId),
      };

    case 'expert-management':
      return {
        ...basePayload,
        notificationType:
          STRIPE_TO_EXPERT_NOTIFICATION_TYPE[stripePayload.eventType] || 'account-update',
        expertName: customer?.name || 'Expert',
        amount: stripePayload.amount ? (stripePayload.amount / 100).toFixed(2) : undefined,
        currency: (stripePayload.currency || 'eur').toUpperCase(),
        message: `Account update: ${stripePayload.eventType}`,
      };

    default:
      // Passthrough for unmapped workflows - preserve original data
      return {
        ...basePayload,
        ...stripePayload,
      };
  }
}

/**
 * Get workflow ID from Stripe event type
 * @param eventType - Stripe webhook event type
 * @returns Workflow ID or undefined if not mapped
 */
export function getWorkflowFromStripeEvent(eventType: string): string | undefined {
  return STRIPE_EVENT_TO_WORKFLOW_MAPPINGS[
    eventType as keyof typeof STRIPE_EVENT_TO_WORKFLOW_MAPPINGS
  ];
}
