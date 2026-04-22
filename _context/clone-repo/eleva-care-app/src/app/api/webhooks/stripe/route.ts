import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { PaymentTransfersTable, SlotReservationsTable } from '@/drizzle/schema';
import {
  isValidPaymentStatus,
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_SUCCEEDED,
  type PaymentStatus,
  STRIPE_PAYMENT_STATUS_NO_PAYMENT_REQUIRED,
  STRIPE_PAYMENT_STATUS_PAID,
  STRIPE_PAYMENT_STATUS_UNPAID,
} from '@/lib/constants/payment-statuses';
import { PAYMENT_TRANSFER_STATUS_PENDING } from '@/lib/constants/payment-transfers';
import {
  buildNovuSubscriberFromStripe,
  getWorkflowFromStripeEvent,
  triggerNovuWorkflow,
} from '@/lib/integrations/novu/utils';
import { getServerStripe } from '@/lib/integrations/stripe';
import { createMeeting } from '@/server/actions/meetings';
import { ensureFullUserSynchronization } from '@/server/actions/user-sync';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { handleAccountUpdated } from './handlers/account';
import {
  handleExternalAccountCreated,
  handleExternalAccountDeleted,
} from './handlers/external-account';
import { handleIdentityVerificationUpdated } from './handlers/identity';
import {
  handleChargeRefunded,
  handleDisputeCreated,
  handlePaymentFailed,
  handlePaymentIntentRequiresAction,
  handlePaymentSucceeded,
} from './handlers/payment';
import { handlePayoutFailed, handlePayoutPaid } from './handlers/payout';

const { logger } = Sentry;

/**
 * Zod schema for meeting metadata validation
 */
const MeetingMetadataSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  expert: z.string().min(1, 'Expert ID is required'),
  guest: z.string().email('Invalid guest email'),
  guestName: z.string().optional(),
  start: z
    .string()
    .refine(
      (val) => !Number.isNaN(Date.parse(val)),
      'Invalid start time format - must be ISO 8601',
    ),
  dur: z.number().positive('Duration must be positive'),
  notes: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

/**
 * Zod schema for payment metadata validation
 */
const PaymentMetadataSchema = z.object({
  amount: z.string().refine((val) => {
    const num = Number(val);
    return !Number.isNaN(num) && num > 0;
  }, 'Amount must be a positive number'),
  fee: z.string().refine((val) => {
    const num = Number(val);
    return !Number.isNaN(num) && num >= 0;
  }, 'Fee must be a non-negative number'),
  expert: z.string().refine((val) => {
    const num = Number(val);
    return !Number.isNaN(num) && num > 0;
  }, 'Expert amount must be a positive number'),
});

/**
 * Zod schema for transfer delay validation
 */
const TransferDelaySchema = z.object({
  aging: z.number().int().min(0, 'Aging days must be non-negative'),
  remaining: z.number().int().min(0, 'Remaining days must be non-negative'),
  required: z.number().int().min(0, 'Required days must be non-negative'),
});

/**
 * Zod schema for transfer metadata validation
 */
const TransferMetadataSchema = z.object({
  status: z.string().min(1, 'Transfer status is required'),
  account: z.string().min(1, 'Connect account ID is required'),
  country: z.string().min(2, 'Country code must be at least 2 characters'),
  delay: TransferDelaySchema,
  scheduled: z
    .string()
    .refine(
      (val) => !Number.isNaN(Date.parse(val)),
      'Invalid scheduled time format - must be ISO 8601',
    ),
});

// Update interfaces to match Zod schemas
type ParsedMeetingMetadata = z.infer<typeof MeetingMetadataSchema>;
type ParsedPaymentMetadata = z.infer<typeof PaymentMetadataSchema>;
type ParsedTransferMetadata = z.infer<typeof TransferMetadataSchema>;

/**
 * Extended Stripe Checkout Session type with our custom metadata structure.
 *
 * The metadata is split into chunks to:
 * - Stay under Stripe's 500-character limit
 * - Maintain logical grouping of data
 * - Support future extensibility
 */
interface StripeCheckoutSession extends Stripe.Checkout.Session {
  metadata: {
    /** JSON string of meeting details (ParsedMeetingMetadata) */
    meeting?: string;
    /** JSON string of payment details (ParsedPaymentMetadata) */
    payment?: string;
    /** JSON string of transfer configuration (ParsedTransferMetadata) */
    transfer?: string;
    /** Whether manual approval is required before payout */
    approval?: string;
  };
  application_fee_amount?: number | null;
  payment_intent: string | null;
}

/**
 * Metadata structure for Stripe integration.
 *
 * The metadata is split into three logical chunks to optimize size and maintainability:
 * 1. meeting: Core session information
 * 2. payment: Financial transaction details
 * 3. transfer: Expert payout configuration
 *
 * Each chunk is stored as a JSON string in Stripe metadata, with abbreviated field names
 * to stay under Stripe's 500-character metadata limit while maintaining readability.
 */

/**
 * Meeting metadata chunk - Contains core session information.
 * Field names are intentionally abbreviated to reduce metadata size.
 *
 * Flow:
 * 1. Created in create-payment-intent
 * 2. Stored in Stripe checkout session
 * 3. Retrieved and parsed in webhook handlers
 */

/**
 * Helper function to parse metadata safely with enhanced error logging
 * @param json The JSON string to parse
 * @param fallback Default value to return if parsing fails
 * @param type Optional metadata type for better error context
 * @returns Parsed metadata or fallback value
 */
function parseMetadata<T>(json: string | undefined, fallback: T, type?: string): T {
  if (!json) {
    logger.warn('Empty metadata received:', {
      type,
      fallbackUsed: fallback,
    });
    return fallback;
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    // Log detailed error information for debugging
    logger.error('Failed to parse metadata:', {
      type,
      json: json.length > 500 ? `${json.slice(0, 500)}... (truncated)` : json,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      fallbackUsed: fallback,
    });

    // Log warning if JSON looks malformed
    if (json.includes('\n') || json.includes('\r')) {
      logger.warn('Metadata contains newlines which may indicate formatting issues');
    }
    if (!json.startsWith('{') && !json.startsWith('[')) {
      logger.warn('Metadata does not start with { or [ which may indicate invalid JSON');
    }

    return fallback;
  }
}

// Helper function to safely extract guest name
function getGuestName(metadata: ParsedMeetingMetadata): string {
  // Use provided guest name if available
  if (metadata?.guestName?.trim()) {
    return metadata.guestName.trim();
  }

  // Fallback: Try to derive from email, but handle special cases
  const emailPrefix = metadata.guest.split('@')[0];
  // Replace dots and special characters with spaces, then clean up
  return emailPrefix
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Add simple GET handler
export async function GET() {
  return NextResponse.json(
    {
      message:
        'This endpoint is for Stripe webhooks. Send POST requests with valid Stripe signatures.',
    },
    { status: 200 },
  );
}

/**
 * Helper function to validate critical meeting metadata fields
 * @throws {Error} if any required field is missing or invalid
 */
function validateMeetingMetadata(
  metadata: ParsedMeetingMetadata,
  sessionId: string,
  rawMetadata?: string,
): void {
  const missingFields = [];

  if (!metadata.id) missingFields.push('id');
  if (!metadata.expert) missingFields.push('expert');
  if (!metadata.guest) missingFields.push('guest');
  if (!metadata.start) missingFields.push('start');
  if (typeof metadata.dur !== 'number' || metadata.dur <= 0) missingFields.push('duration');

  if (missingFields.length > 0) {
    logger.error('Critical meeting metadata missing or invalid:', {
      sessionId,
      missingFields,
      metadata,
      rawMetadata,
    });
    throw new Error(`Critical meeting metadata is missing or invalid: ${missingFields.join(', ')}`);
  }
}

/**
 * Helper function to validate critical transfer metadata fields
 * @throws {Error} if any required field is missing or invalid
 */
function validateTransferMetadata(
  metadata: ParsedTransferMetadata,
  sessionId: string,
  rawMetadata?: string,
): void {
  const missingFields = [];

  if (!metadata.account) missingFields.push('account');
  if (!metadata.country) missingFields.push('country');
  if (!metadata.scheduled) missingFields.push('scheduled');

  // Validate delay object structure
  if (!metadata.delay || typeof metadata.delay !== 'object') {
    missingFields.push('delay configuration');
  } else {
    if (typeof metadata.delay.aging !== 'number') missingFields.push('delay.aging');
    if (typeof metadata.delay.remaining !== 'number') missingFields.push('delay.remaining');
    if (typeof metadata.delay.required !== 'number') missingFields.push('delay.required');
  }

  if (missingFields.length > 0) {
    logger.error('Critical transfer metadata missing or invalid:', {
      sessionId,
      missingFields,
      metadata,
      rawMetadata,
    });
    throw new Error(
      `Critical transfer metadata is missing or invalid: ${missingFields.join(', ')}`,
    );
  }
}

/**
 * Validates that a metadata string exists and is not empty
 * @throws {Error} if the metadata string is missing or empty
 */
function validateMetadataString(
  metadata: string | undefined,
  type: 'meeting' | 'payment' | 'transfer',
  sessionId: string,
): void {
  if (!metadata?.trim()) {
    logger.error(`Missing or empty ${type} metadata in checkout session:`, {
      sessionId,
      metadata,
    });
    throw new Error(`Missing or empty ${type} metadata in session. Cannot process ${type} data.`);
  }

  try {
    JSON.parse(metadata);
  } catch (error) {
    logger.error(`Invalid JSON in ${type} metadata:`, {
      sessionId,
      metadata,
      error,
    });
    throw new Error(`Invalid JSON in ${type} metadata. Cannot process ${type} data.`);
  }
}

/**
 * Helper function to validate and parse metadata with Zod schema
 */
function validateAndParseMetadata<T>(
  metadata: string | undefined,
  type: string,
  sessionId: string,
  schema: z.ZodSchema<T>,
  defaultValues: Partial<T>,
): T {
  // First validate the string
  validateMetadataString(metadata, type as 'meeting' | 'payment' | 'transfer', sessionId);

  // Parse the JSON
  const rawData = parseMetadata(metadata, defaultValues, type);

  try {
    // Validate against schema
    return schema.parse(rawData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(`Invalid ${type} metadata structure:`, {
        sessionId,
        errors: error.issues,
        rawData,
      });
      throw new Error(
        `Invalid ${type} metadata structure: ${error.issues.map((e) => e.message).join(', ')}`,
      );
    }
    throw error;
  }
}

async function handleCheckoutSession(session: StripeCheckoutSession) {
  Sentry.logger.info('Starting checkout session processing', {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
  });

  try {
    // First check if we already have a meeting for this session
    const existingMeeting = await db.query.MeetingsTable.findFirst({
      where: ({ stripeSessionId }, { eq }) => eq(stripeSessionId, session.id),
    });

    if (existingMeeting) {
      Sentry.logger.info('Meeting already exists for session', {
        sessionId: session.id,
        meetingId: existingMeeting.id,
        hasUrl: !!existingMeeting.meetingUrl,
      });
      return { success: true, meetingId: existingMeeting.id };
    }

    // Parse and validate metadata with Zod schemas
    const meetingData = validateAndParseMetadata(
      session.metadata?.meeting,
      'meeting',
      session.id,
      MeetingMetadataSchema,
      {
        id: '',
        expert: '',
        guest: '',
        start: '',
        dur: 0,
      },
    );

    let paymentData: ParsedPaymentMetadata | undefined;
    let transferData: ParsedTransferMetadata | undefined;

    if (session.payment_intent) {
      paymentData = validateAndParseMetadata(
        session.metadata?.payment,
        'payment',
        session.id,
        PaymentMetadataSchema,
        {
          amount: '0',
          fee: '0',
          expert: '0',
        },
      );

      transferData = validateAndParseMetadata(
        session.metadata?.transfer,
        'transfer',
        session.id,
        TransferMetadataSchema,
        {
          status: PAYMENT_TRANSFER_STATUS_PENDING,
          account: '',
          country: '',
          delay: { aging: 0, remaining: 0, required: 0 },
          scheduled: '',
        },
      );
    }

    // Validate critical meeting metadata
    validateMeetingMetadata(meetingData, session.id, session.metadata?.meeting);

    // Validate critical transfer metadata if payment intent exists
    if (session.payment_intent) {
      if (!paymentData || !transferData) {
        throw new Error('Payment and transfer metadata required when payment_intent exists');
      }
      validateTransferMetadata(transferData, session.id, session.metadata?.transfer);
    }

    // If we have the expert's user ID, ensure synchronization
    if (meetingData.expert) {
      try {
        Sentry.logger.debug('Ensuring user synchronization', { expertId: meetingData.expert });
        await ensureFullUserSynchronization(meetingData.expert);
      } catch (error) {
        Sentry.logger.error('Failed to synchronize user data', {
          expertId: meetingData.expert,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue processing even if synchronization fails
      }
    }

    const mappedStatus = mapPaymentStatus(session.payment_status, session.id);
    Sentry.logger.info('Creating meeting with payment status', {
      sessionId: session.id,
      status: session.payment_status,
      mappedStatus,
      willCreateCalendar:
        !session.payment_status ||
        session.payment_status === 'paid' ||
        mappedStatus === 'succeeded',
    });

    const result = await createMeeting({
      eventId: meetingData.id,
      workosUserId: meetingData.expert,
      startTime: new Date(meetingData.start),
      guestEmail: meetingData.guest,
      guestName: getGuestName(meetingData),
      guestNotes: meetingData.notes,
      timezone: meetingData.timezone || 'UTC', // Use provided timezone or fallback to UTC
      stripeSessionId: session.id,
      stripePaymentStatus: mappedStatus,
      stripeAmount: session.amount_total ?? undefined,
      stripeApplicationFeeAmount: session.application_fee_amount ?? undefined,
      locale: meetingData.locale || 'en',
    });

    // Handle possible errors
    if (result.error) {
      Sentry.logger.error('Failed to create meeting from checkout session', {
        sessionId: session.id,
        error: result.error,
        code: result.code,
        message: 'message' in result ? result.message : undefined,
      });

      // Handle refund for double booking
      if (
        result.code === 'SLOT_ALREADY_BOOKED' &&
        session.payment_status === STRIPE_PAYMENT_STATUS_PAID &&
        typeof session.payment_intent === 'string'
      ) {
        await handleDoubleBookingRefund(session.payment_intent);
      }

      return { success: false, error: result.error };
    }

    // At this point we know result.error is false and meeting should exist
    const meeting = 'meeting' in result ? result.meeting : undefined;

    Sentry.logger.info('Meeting created successfully from checkout session', {
      sessionId: session.id,
      meetingId: meeting?.id,
      hasUrl: !!meeting?.meetingUrl,
      paymentStatus: meeting?.stripePaymentStatus,
    });

    // Clean up any existing slot reservation since meeting is now confirmed
    // This handles Multibanco payments where a reservation was created during pending state
    if (meeting && session.payment_intent) {
      try {
        const deletedReservations = await db
          .delete(SlotReservationsTable)
          .where(eq(SlotReservationsTable.stripePaymentIntentId, session.payment_intent.toString()))
          .returning({ id: SlotReservationsTable.id });

        if (deletedReservations.length > 0) {
          Sentry.logger.info('Cleaned up slot reservations after meeting confirmation', {
            sessionId: session.id,
            meetingId: meeting.id,
            deletedCount: deletedReservations.length,
          });
        }
      } catch (cleanupError) {
        Sentry.logger.error('Failed to clean up slot reservation after meeting creation', {
          sessionId: session.id,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
        });
        // Don't fail the process - reservation will expire naturally
      }
    }

    // NOTE: Slot reservations are NOT created here for confirmed payments.
    // For card payments: Meeting creation IS the final booking
    // For Multibanco: Reservations are created when payment_intent is created (during pending state)
    // Once payment is confirmed, the meeting record serves as the booking

    // Create payment transfer record if payment intent exists
    if (session.payment_intent) {
      await createPaymentTransferIfNotExists({
        session,
        meetingData,
        paymentData,
        transferData,
      });
    }

    return { success: true, meetingId: meeting?.id };
  } catch (error) {
    Sentry.logger.error('Error processing checkout session', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function handleDoubleBookingRefund(paymentIntentId: string) {
  return Sentry.startSpan(
    {
      name: 'stripe.refund.double_booking',
      op: 'stripe.api',
      attributes: {
        'stripe.payment_intent_id': paymentIntentId,
        'stripe.refund_reason': 'duplicate',
      },
    },
    async (span) => {
      const stripe = await getServerStripe();
      // Check if a refund already exists
      const existing = await stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });

      if (existing.data.length === 0) {
        Sentry.logger.info('Initiating refund for double booking', { paymentIntentId });
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: 'duplicate',
        });
        span.setAttribute('stripe.refund_id', refund.id);
        span.setAttribute('stripe.refund_created', true);
        Sentry.logger.info('Double booking refund created', {
          paymentIntentId,
          refundId: refund.id,
        });
      } else {
        span.setAttribute('stripe.refund_created', false);
        span.setAttribute('stripe.refund_id', existing.data[0].id);
        Sentry.logger.info('Refund already exists for payment intent', {
          paymentIntentId,
          refundId: existing.data[0].id,
        });
      }
    },
  );
}

async function createPaymentTransferIfNotExists({
  session,
  meetingData,
  paymentData,
  transferData,
}: {
  session: StripeCheckoutSession;
  meetingData: ParsedMeetingMetadata;
  paymentData?: ParsedPaymentMetadata;
  transferData?: ParsedTransferMetadata;
}) {
  return Sentry.startSpan(
    {
      name: 'stripe.transfer.create_if_not_exists',
      op: 'db.write',
      attributes: {
        'stripe.session_id': session.id,
        'stripe.event_id': meetingData.id,
      },
    },
    async (span) => {
      // Check for existing transfer
      const existingTransfer = await db.query.PaymentTransfersTable.findFirst({
        where: eq(PaymentTransfersTable.checkoutSessionId, session.id),
      });

      if (existingTransfer) {
        span.setAttribute('stripe.transfer.already_exists', true);
        Sentry.logger.debug('Transfer record already exists for session', {
          sessionId: session.id,
        });
        return;
      }

      // Validate required fields and data
      if (!session.payment_intent) {
        throw new Error('Payment intent ID is required for transfer record creation');
      }

      if (!paymentData || !transferData) {
        throw new Error('Payment and transfer data are required for transfer record creation');
      }

      if (!transferData.account) {
        throw new Error('Expert Connect account ID is required for transfer record creation');
      }

      // Parse and validate payment amounts
      const amount = Number.parseInt(paymentData.expert, 10);
      const platformFee = Number.parseInt(paymentData.fee, 10);

      // Validate parsed amounts
      if (Number.isNaN(amount) || amount <= 0) {
        Sentry.logger.error('Invalid expert payment amount', {
          sessionId: session.id,
          rawAmount: paymentData.expert,
          parsedAmount: amount,
        });
        throw new Error(`Invalid expert payment amount: ${paymentData.expert}`);
      }

      if (Number.isNaN(platformFee) || platformFee < 0) {
        Sentry.logger.error('Invalid platform fee', {
          sessionId: session.id,
          rawFee: paymentData.fee,
          parsedFee: platformFee,
        });
        throw new Error(`Invalid platform fee: ${paymentData.fee}`);
      }

      span.setAttribute('stripe.transfer.amount', amount);
      span.setAttribute('stripe.transfer.platform_fee', platformFee);
      span.setAttribute('stripe.transfer.currency', session.currency || 'eur');

      // Create new transfer record with validated data
      await db.insert(PaymentTransfersTable).values({
        paymentIntentId: session.payment_intent,
        checkoutSessionId: session.id,
        eventId: meetingData.id,
        expertConnectAccountId: transferData.account,
        expertWorkosUserId: meetingData.expert,
        amount,
        platformFee,
        currency: session.currency || 'eur',
        sessionStartTime: new Date(meetingData.start),
        scheduledTransferTime: new Date(transferData.scheduled),
        status: PAYMENT_TRANSFER_STATUS_PENDING,
        requiresApproval: session.metadata?.approval === 'true',
        created: new Date(),
        updated: new Date(),
      });

      span.setAttribute('stripe.transfer.created', true);
      Sentry.logger.info('Created payment transfer record', {
        sessionId: session.id,
        amount,
        platformFee,
        currency: session.currency || 'eur',
      });
    },
  );
}

// Map Stripe payment status to database enum with proper validation
const mapPaymentStatus = (stripeStatus: string, sessionId?: string): PaymentStatus => {
  switch (stripeStatus) {
    case STRIPE_PAYMENT_STATUS_PAID:
      return PAYMENT_STATUS_SUCCEEDED;
    case STRIPE_PAYMENT_STATUS_UNPAID:
      return PAYMENT_STATUS_PENDING;
    case STRIPE_PAYMENT_STATUS_NO_PAYMENT_REQUIRED:
      return PAYMENT_STATUS_SUCCEEDED; // Treat as succeeded since no payment is needed
    default:
      // Validate if the status is already a valid database payment status
      if (isValidPaymentStatus(stripeStatus)) {
        return stripeStatus;
      }

      // Log warning for unknown statuses and return safe default
      Sentry.logger.warn('Unknown Stripe payment status encountered', {
        sessionId,
        unknownStatus: stripeStatus,
        defaultingTo: PAYMENT_STATUS_PENDING,
        validStatuses: [
          'paid',
          'unpaid',
          'no_payment_required',
          'pending',
          'processing',
          'succeeded',
          'failed',
          'refunded',
        ],
      });
      return PAYMENT_STATUS_PENDING;
  }
};

/**
 * Trigger Novu notification workflows based on Stripe events
 * @param event - The verified Stripe webhook event
 */
async function triggerNovuNotificationFromStripeEvent(event: Stripe.Event) {
  try {
    const stripe = await getServerStripe();
    // Check if we have a workflow mapped for this event
    const workflowId = getWorkflowFromStripeEvent(event.type);

    if (!workflowId) {
      logger.info(`No Novu workflow mapped for Stripe event: ${event.type}`);
      return;
    }

    // Get customer information for most events
    let customerId: string | undefined;
    let customer: Stripe.Customer | undefined;

    // Extract customer ID from different event types
    if ('customer' in event.data.object && typeof event.data.object.customer === 'string') {
      customerId = event.data.object.customer;
    } else if (
      'charges' in event.data.object &&
      event.data.object.charges &&
      typeof event.data.object.charges === 'object' &&
      'data' in event.data.object.charges &&
      Array.isArray(event.data.object.charges.data) &&
      event.data.object.charges.data[0]?.customer
    ) {
      customerId = event.data.object.charges.data[0].customer as string;
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      customerId = session.customer as string;
    }

    // Retrieve customer data if we have a customer ID
    if (customerId) {
      try {
        customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
      } catch (error) {
        logger.warn(`Could not retrieve customer ${customerId} for Novu notification:`, { error } as Record<string, unknown>);
      }
    }

    // If we don't have customer data, skip the notification
    if (!customer || !customerId) {
      logger.info(
        `No customer data available for Stripe event: ${event.type}, skipping Novu notification`,
      );
      return;
    }

    // Build subscriber data from Stripe customer
    const subscriber = buildNovuSubscriberFromStripe(customer);

    // Create payload with event data
    const payload = {
      eventType: event.type,
      eventId: event.id,
      eventData: event.data.object,
      timestamp: Date.now(),
      source: 'stripe_webhook',
      amount: 'amount' in event.data.object ? event.data.object.amount : undefined,
      currency: 'currency' in event.data.object ? event.data.object.currency : undefined,
    };

    // Trigger the Novu workflow
    logger.info(`Triggering Novu workflow '${workflowId}' for Stripe event '${event.type}'`);
    const result = await triggerNovuWorkflow(workflowId, subscriber, payload);

    if (result.success) {
      logger.info(`Successfully triggered Novu workflow for Stripe event: ${event.type}`);
    } else {
      logger.error(`Failed to trigger Novu workflow for Stripe event:`, { error: result.error } as Record<string, unknown>);
    }
  } catch (error) {
    logger.error('Error triggering Novu notification from Stripe event:', { error } as Record<string, unknown>);
    // Don't throw - we don't want Novu failures to break webhook processing
  }
}

/**
 * Handles webhook events from Stripe for identity verification and Connect accounts
 *
 * @param request The incoming request from Stripe
 * @returns A JSON response indicating success or failure
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    Sentry.logger.error('Stripe webhook missing signature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    Sentry.logger.error('Stripe webhook secret not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const stripe = await getServerStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    Sentry.logger.error('Stripe webhook signature verification failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Process the event based on type
  return Sentry.startSpan(
    {
      name: `stripe.webhook.${event.type}`,
      op: 'webhook.handler',
      attributes: {
        'stripe.event_id': event.id,
        'stripe.event_type': event.type,
        'stripe.api_version': event.api_version || 'unknown',
        'stripe.livemode': event.livemode,
      },
    },
    async (span) => {
      try {
        Sentry.logger.info('Processing Stripe webhook event', {
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
        });

        switch (event.type) {
          case 'account.updated':
            await handleAccountUpdated(event.data.object as Stripe.Account);
            break;
          case 'identity.verification_session.verified':
          case 'identity.verification_session.requires_input': {
            // Validate that the object has the expected properties of a verification session
            const obj = event.data.object;
            if (!obj || typeof obj !== 'object' || !('status' in obj) || !('id' in obj)) {
              Sentry.logger.error('Invalid verification session object', { obj });
              break;
            }
            const verificationSession = obj as Stripe.Identity.VerificationSession;

            // For identity verification, we need to find the user by the verification status
            // and extract any related account ID from the metadata
            await handleIdentityVerificationUpdated(verificationSession);
            break;
          }
          case 'checkout.session.completed':
            try {
              const session = event.data.object as StripeCheckoutSession;
              Sentry.logger.info('Processing checkout.session.completed', {
                sessionId: session.id,
                paymentStatus: session.payment_status,
                paymentIntent:
                  typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
              });

              const sessionResult = await Sentry.startSpan(
                {
                  name: 'stripe.checkout.session.handle',
                  op: 'stripe.api',
                  attributes: {
                    'stripe.session_id': session.id,
                    'stripe.payment_status': session.payment_status,
                  },
                },
                async (checkoutSpan) => {
                  const result = await handleCheckoutSession(session);
                  checkoutSpan.setAttribute('stripe.checkout.success', result.success);
                  return result;
                },
              );

              Sentry.logger.info('Checkout session processing completed', {
                sessionId: session.id,
                success: sessionResult.success,
              });
            } catch (error) {
              Sentry.logger.error('Error in checkout.session.completed handler', {
                error: error instanceof Error ? error.message : 'Unknown error',
                sessionId: event.data.object.id,
              });
              throw error; // Rethrow to be caught by the outer try-catch
            }
            break;
          case 'payment_intent.succeeded':
            await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
            break;
          case 'payment_intent.payment_failed':
            await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
            break;
          case 'payment_intent.requires_action':
            await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
            break;
          case 'charge.refunded':
            await handleChargeRefunded(event.data.object as Stripe.Charge);
            break;
          case 'charge.dispute.created':
            await handleDisputeCreated(event.data.object as Stripe.Dispute);
            break;
          case 'account.external_account.created':
            if ('account' in event.data.object && typeof event.data.object.account === 'string') {
              await handleExternalAccountCreated(
                event.data.object as Stripe.BankAccount | Stripe.Card,
                event.data.object.account,
              );
            }
            break;
          case 'account.external_account.deleted':
            if ('account' in event.data.object && typeof event.data.object.account === 'string') {
              await handleExternalAccountDeleted(
                event.data.object as Stripe.BankAccount | Stripe.Card,
                event.data.object.account,
              );
            }
            break;
          case 'payment_intent.created': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            Sentry.logger.info('Payment intent created', {
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
            });

            // No immediate slot reservation needed - this will be handled by webhooks based on payment method
            // For credit cards: payment_intent.succeeded → create meeting directly
            // For Multibanco: payment_intent.requires_action → create slot reservation → payment_intent.succeeded → convert to meeting
            Sentry.logger.debug(
              'Payment intent created - slot management delegated to payment method specific webhooks',
              { paymentIntentId: paymentIntent.id },
            );
            break;
          }
          case 'payout.paid':
            await handlePayoutPaid(event.data.object as Stripe.Payout);
            break;
          case 'payout.failed':
            await handlePayoutFailed(event.data.object as Stripe.Payout);
            break;
          default:
            Sentry.logger.debug(`Unhandled Stripe event type: ${event.type}`, {
              eventId: event.id,
            });
        }

        // 🔔 NEW: Trigger Novu notification workflows after processing the event
        // This is a non-blocking operation - if it fails, we still want to acknowledge the webhook
        try {
          await triggerNovuNotificationFromStripeEvent(event);
          Sentry.logger.info('Novu notification workflow triggered successfully', {
            eventType: event.type,
            eventId: event.id,
          });
        } catch (novuError) {
          Sentry.logger.warn('Novu notification failed (non-blocking)', {
            error: novuError instanceof Error ? novuError.message : 'Unknown error',
            eventType: event.type,
            eventId: event.id,
          });
          // Don't throw - Novu failures shouldn't block webhook processing
        }

        span.setAttribute('stripe.webhook.success', true);
        return NextResponse.json({ received: true });
      } catch (error) {
        span.setAttribute('stripe.webhook.success', false);
        Sentry.logger.error('Error processing Stripe webhook event', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          eventType: event?.type || 'unknown',
          eventId: event?.id || 'unknown',
        });
        return NextResponse.json(
          { error: 'Internal server error processing webhook' },
          { status: 500 },
        );
      }
    },
  );
}
