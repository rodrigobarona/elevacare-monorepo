import * as Sentry from '@sentry/nextjs';
import {
  calculateApplicationFee,
  DEFAULT_COUNTRY,
  getMinimumPayoutDelay,
  STRIPE_CONFIG,
} from '@/config/stripe';
import { getServerStripe } from '@/lib/integrations/stripe';

const { logger } = Sentry;
import { db } from '@/drizzle/db';
import { EventsTable, MeetingsTable, SlotReservationsTable } from '@/drizzle/schema';
import { PAYMENT_TRANSFER_STATUS_PENDING } from '@/lib/constants/payment-transfers';
import { getOrCreateStripeCustomer } from '@/lib/integrations/stripe';
import { FormCache, IdempotencyCache } from '@/lib/redis/manager';
import { checkRateLimit } from '@/lib/redis/rate-limiter';
import { checkBotId } from 'botid/server';
import { and, eq, gt } from 'drizzle-orm';
import type { Locale } from '@/lib/i18n/routing';
import { locales, defaultLocale } from '@/lib/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { after, NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Payment rate limiting configuration (stricter than identity verification)
const PAYMENT_RATE_LIMITS = {
  // User-based limits (very strict for financial operations)
  USER: {
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
    description: 'per user per 15 minutes',
  },
  // IP-based limits (abuse prevention)
  IP: {
    maxAttempts: 20,
    windowSeconds: 900, // 15 minutes
    description: 'per IP per 15 minutes',
  },
  // Global system protection
  GLOBAL: {
    maxAttempts: 1000,
    windowSeconds: 60, // 1 minute
    description: 'system-wide per minute',
  },
  // Daily user limits (additional protection)
  USER_DAILY: {
    maxAttempts: 20,
    windowSeconds: 86400, // 24 hours
    description: 'per user per day',
  },
} as const;

/**
 * Multi-layer atomic payment rate limiting.
 * Each `checkRateLimit` call atomically checks AND increments.
 */
async function checkPaymentRateLimits(userIdentifier: string, clientIP: string) {
  try {
    const userLimit = await checkRateLimit(
      `payment:${userIdentifier}`,
      PAYMENT_RATE_LIMITS.USER.maxAttempts,
      PAYMENT_RATE_LIMITS.USER.windowSeconds,
    );
    if (!userLimit.allowed) {
      return {
        allowed: false as const,
        reason: 'user_limit_exceeded',
        message: `Too many payment attempts. You can try again in ${Math.ceil((userLimit.resetTime - Date.now()) / 1000)} seconds.`,
        resetTime: userLimit.resetTime,
        remaining: userLimit.remaining,
        limit: `${PAYMENT_RATE_LIMITS.USER.maxAttempts} ${PAYMENT_RATE_LIMITS.USER.description}`,
      };
    }

    const userDailyLimit = await checkRateLimit(
      `payment:daily:${userIdentifier}`,
      PAYMENT_RATE_LIMITS.USER_DAILY.maxAttempts,
      PAYMENT_RATE_LIMITS.USER_DAILY.windowSeconds,
    );
    if (!userDailyLimit.allowed) {
      return {
        allowed: false as const,
        reason: 'user_daily_limit_exceeded',
        message: 'Daily payment attempt limit reached. Please try again tomorrow or contact support if you need assistance.',
        resetTime: userDailyLimit.resetTime,
        remaining: userDailyLimit.remaining,
        limit: `${PAYMENT_RATE_LIMITS.USER_DAILY.maxAttempts} ${PAYMENT_RATE_LIMITS.USER_DAILY.description}`,
      };
    }

    const ipLimit = await checkRateLimit(
      `payment:ip:${clientIP}`,
      PAYMENT_RATE_LIMITS.IP.maxAttempts,
      PAYMENT_RATE_LIMITS.IP.windowSeconds,
    );
    if (!ipLimit.allowed) {
      return {
        allowed: false as const,
        reason: 'ip_limit_exceeded',
        message: `Too many payment attempts from this location. Please try again in ${Math.ceil((ipLimit.resetTime - Date.now()) / 1000)} seconds.`,
        resetTime: ipLimit.resetTime,
        remaining: ipLimit.remaining,
        limit: `${PAYMENT_RATE_LIMITS.IP.maxAttempts} ${PAYMENT_RATE_LIMITS.IP.description}`,
      };
    }

    const globalLimit = await checkRateLimit(
      'payment:global',
      PAYMENT_RATE_LIMITS.GLOBAL.maxAttempts,
      PAYMENT_RATE_LIMITS.GLOBAL.windowSeconds,
    );
    if (!globalLimit.allowed) {
      return {
        allowed: false as const,
        reason: 'system_limit_exceeded',
        message: 'System is currently experiencing high payment volume. Please try again in a moment.',
        resetTime: globalLimit.resetTime,
        remaining: globalLimit.remaining,
        limit: `${PAYMENT_RATE_LIMITS.GLOBAL.maxAttempts} ${PAYMENT_RATE_LIMITS.GLOBAL.description}`,
      };
    }

    return {
      allowed: true as const,
      limits: {
        user: { remaining: userLimit.remaining, resetTime: userLimit.resetTime, totalHits: userLimit.totalHits },
        userDaily: { remaining: userDailyLimit.remaining, resetTime: userDailyLimit.resetTime, totalHits: userDailyLimit.totalHits },
        ip: { remaining: ipLimit.remaining, resetTime: ipLimit.resetTime, totalHits: ipLimit.totalHits },
        global: { remaining: globalLimit.remaining, resetTime: globalLimit.resetTime, totalHits: globalLimit.totalHits },
      },
    };
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Redis payment rate limiting error', { error });
    logger.warn('Payment rate limiting failed - applying temporary restriction');
    return {
      allowed: false as const,
      reason: 'rate_limiting_error',
      message: 'Payment processing is temporarily unavailable. Please try again in a few moments.',
      fallback: true,
    };
  }
}

// Helper function to create shared metadata for checkout session and payment intent
// Note: sessionId is intentionally NOT included in metadata as it's always available
// in webhook events via event.data.object.id and following Stripe best practices
function createSharedMetadata({
  eventId,
  expertWorkosUserId,
  guestEmail,
  guestName,
  startTime,
  duration,
  guestNotes,
  price,
  platformFee,
  expertAmount,
  expertStripeAccountId,
  expertCountry,
  paymentAgingDays,
  requiredPayoutDelay,
  scheduledTransferTime,
  appointmentEndTime,
  requiresApproval,
  meetingData,
}: {
  eventId: string;
  expertWorkosUserId: string;
  guestEmail: string;
  guestName: string;
  startTime: string;
  duration: number;
  guestNotes?: string;
  price: number;
  platformFee: number;
  expertAmount: number;
  expertStripeAccountId: string;
  expertCountry: string;
  paymentAgingDays: number;
  requiredPayoutDelay: number;
  scheduledTransferTime: Date;
  appointmentEndTime: Date;
  requiresApproval: boolean;
  meetingData: {
    timezone?: string;
    locale?: string;
    guestEmail: string;
    guestName: string;
    startTime: string;
    guestNotes?: string;
  };
}) {
  return {
    meeting: JSON.stringify({
      id: eventId,
      expert: expertWorkosUserId,
      guest: guestEmail,
      guestName: guestName,
      start: startTime,
      dur: duration,
      notes: guestNotes || '',
    }),
    payment: JSON.stringify({
      amount: price.toString(),
      fee: platformFee.toString(),
      expert: expertAmount.toString(),
    }),
    transfer: JSON.stringify({
      status: PAYMENT_TRANSFER_STATUS_PENDING,
      account: expertStripeAccountId,
      country: expertCountry || 'Unknown',
      delay: {
        aging: paymentAgingDays,
        required: requiredPayoutDelay,
      },
      scheduled: scheduledTransferTime.toISOString(),
      appointmentEnd: appointmentEndTime.toISOString(), // 🆕 Added for late payment validation
    }),
    approval: requiresApproval.toString(),
    // Add tax and locale handling at root level of metadata
    isEuropeanCustomer: meetingData.timezone?.includes('Europe') ? 'true' : 'false',
    preferredTaxHandling: 'vat_only',
  };
}

export async function POST(request: NextRequest) {
  logger.info('Starting payment intent creation process');

  // 🛡️ BotID Protection: Check for bot traffic before processing payment
  const botResult = (await checkBotId({
    advancedOptions: {
      checkLevel: 'basic', // Free on all Vercel plans including Hobby
    },
  })) as import('@/types/botid').BotIdVerificationResult;

  if (botResult.isBot) {
    logger.warn('Bot detected in payment intent creation', {
      isVerifiedBot: botResult.isVerifiedBot,
      verifiedBotName: botResult.verifiedBotName,
      verifiedBotCategory: botResult.verifiedBotCategory,
    });

    // Allow verified bots that might be legitimate (e.g., monitoring services)
    // Using the predefined list from types/botid.ts
    const { COMMON_ALLOWED_BOTS } = await import('@/types/botid');
    const allowedVerifiedBots = COMMON_ALLOWED_BOTS as readonly string[];
    const isAllowedBot =
      botResult.isVerifiedBot &&
      botResult.verifiedBotName !== undefined &&
      allowedVerifiedBots.includes(botResult.verifiedBotName);

    if (!isAllowedBot) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Automated requests are not allowed for payment processing',
        },
        { status: 403 },
      );
    }
  }

  // Declare variables in function scope for access in catch block
  let eventId: string = '';
  let meetingData:
    | {
        timezone?: string;
        locale?: string;
        guestEmail: string;
        guestName: string;
        startTime: string;
        guestNotes?: string;
        duration?: number;
      }
    | undefined;

  try {
    // Parse request body first to get expert's workosUserId
    const body = await request.json();
    logger.info('Request body received', {
      eventId: body.eventId,
      hasPrice: !!body.price,
      hasMeetingData: !!body.meetingData,
      username: body.username,
      eventSlug: body.eventSlug,
      requiresApproval: !!body.requiresApproval,
      workosUserId: body.workosUserId,
    });

    const {
      eventId: extractedEventId,
      workosUserId,
      price,
      meetingData: extractedMeetingData,
      username,
      eventSlug,
      requiresApproval = false,
    } = body;

    // Assign to function-scoped variables
    eventId = extractedEventId;
    meetingData = extractedMeetingData;

    // Validate required fields
    if (!workosUserId) {
      logger.warn('Missing workosUserId (expert user ID)');
      return NextResponse.json({ error: 'Missing expert user ID' }, { status: 400 });
    }

    if (!price || !meetingData?.guestEmail) {
      logger.warn('Missing required fields', {
        hasPrice: !!price,
        hasGuestEmail: !!meetingData?.guestEmail,
      });
      return NextResponse.json(
        {
          message: 'Missing required fields: price and guest email are required',
        },
        { status: 400 },
      );
    }

    if (!meetingData?.startTime) {
      logger.warn('Missing startTime in meeting data');
      return NextResponse.json({ message: 'Missing required field: startTime' }, { status: 400 });
    }

    // **RATE LIMITING: Apply payment-specific rate limits using guest email instead of userId**
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIP =
      forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

    // Use guest email as identifier for rate limiting since guests aren't authenticated
    const guestIdentifier = `guest:${meetingData.guestEmail}`;
    const rateLimitResult = await checkPaymentRateLimits(guestIdentifier, clientIP);

    if (!rateLimitResult.allowed) {
      logger.info(
        logger.fmt`Payment rate limit exceeded for guest ${meetingData.guestEmail} (IP: ${clientIP})`,
        {
          reason: rateLimitResult.reason,
          limit: rateLimitResult.limit,
          resetTime: rateLimitResult.resetTime,
        },
      );

      return NextResponse.json(
        {
          error: rateLimitResult.message,
          details: {
            reason: rateLimitResult.reason,
            resetTime: rateLimitResult.resetTime,
            limit: rateLimitResult.limit,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit || 'Payment rate limit exceeded',
            'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '0',
            'Retry-After': rateLimitResult.resetTime
              ? Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
              : '60',
          },
        },
      );
    }

    // **IDEMPOTENCY: Check for duplicate requests using distributed cache**
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (idempotencyKey) {
      // Check if we've seen this request before in distributed cache
      const cachedResult = await IdempotencyCache.get(idempotencyKey);
      if (cachedResult) {
        logger.info(logger.fmt`Returning cached result for idempotency key: ${idempotencyKey}`);
        return NextResponse.json({ url: cachedResult.url });
      }
    }

    // **FORM CACHE: Additional duplicate prevention for form submissions**
    if (meetingData?.guestEmail && meetingData?.startTime) {
      const formCacheKey = FormCache.generateKey(
        eventId,
        meetingData.guestEmail,
        meetingData.startTime,
      );

      // Check if this exact form submission is already being processed
      const isAlreadyProcessing = await FormCache.isProcessing(formCacheKey);
      if (isAlreadyProcessing) {
        logger.info('Form submission already in progress (FormCache) - blocking duplicate');
        return NextResponse.json({ error: 'Request already in progress' }, { status: 429 });
      }

      // Mark this submission as processing
      await FormCache.set(formCacheKey, {
        eventId,
        guestEmail: meetingData.guestEmail,
        startTime: meetingData.startTime,
        status: 'processing',
        timestamp: Date.now(),
      });

      logger.info(logger.fmt`Marked form submission as processing in FormCache: ${formCacheKey}`);
    }

    const rawLocale = meetingData.locale || 'en';
    const locale: Locale = locales.includes(rawLocale as Locale)
      ? (rawLocale as Locale)
      : defaultLocale;

    // Construct URLs for legal pages
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care';
    const paymentPoliciesUrl = `${baseUrl}/${locale}/legal/payment-policies`;
    const termsUrl = `${baseUrl}/${locale}/legal/terms-of-service`;

    // Parallel fetch: translations + event details (independent operations)
    logger.info('Querying event details and translations in parallel', { eventId, locale });
    const [t, event] = await Promise.all([
      getTranslations({ locale, namespace: 'Payments.checkout' }),
      db.query.EventsTable.findFirst({
        where: eq(EventsTable.id, eventId),
        with: {
          user: {
            columns: {
              stripeConnectAccountId: true,
              username: true,
              email: true,
              country: true,
            },
          },
        },
      }),
    ]);

    logger.info('Event query results', {
      eventFound: !!event,
      hasUser: !!event?.user,
      hasConnectAccount: !!event?.user?.stripeConnectAccountId,
    });

    if (!event?.user?.stripeConnectAccountId) {
      logger.error('Expert Connect account not found', {
        eventId,
        workosUserId: event?.workosUserId,
      });
      throw new Error("Expert's Connect account not found");
    }

    const expertStripeAccountId = event.user.stripeConnectAccountId;

    const stripe = await getServerStripe();

    // Prepare meeting metadata
    const meetingMetadata = {
      eventId,
      expertId: event.workosUserId,
      expertName: event.user.username || event.user.email || 'Expert',
      guestName: meetingData.guestName,
      guestEmail: meetingData.guestEmail,
      start: meetingData.startTime,
      duration: event.durationInMinutes,
      tz: meetingData.timezone,
      price,
      loc: meetingData.locale || 'en',
      locale: meetingData.locale || 'en',
    };

    // Store guest notes separately in the database if needed
    // We don't include them in Stripe metadata to avoid size limits
    // The notes will be available through the meeting record

    logger.info('Prepared meeting metadata for Stripe', meetingMetadata);

    // **CRITICAL: Check for existing reservations and conflicts BEFORE creating anything**
    const appointmentStartTime = new Date(meetingData.startTime);

    // Parallel check: reservations + confirmed meetings (both depend on same inputs)
    const [existingReservation, conflictingMeeting] = await Promise.all([
      db.query.SlotReservationsTable.findFirst({
        where: and(
          eq(SlotReservationsTable.eventId, eventId),
          eq(SlotReservationsTable.startTime, appointmentStartTime),
          gt(SlotReservationsTable.expiresAt, new Date()),
        ),
      }),
      db.query.MeetingsTable.findFirst({
        where: and(
          eq(MeetingsTable.eventId, eventId),
          eq(MeetingsTable.startTime, appointmentStartTime),
          eq(MeetingsTable.stripePaymentStatus, 'succeeded'),
        ),
      }),
    ]);

    if (existingReservation) {
      // Check if it's the same user (allow them to continue with existing reservation)
      if (existingReservation.guestEmail === meetingData.guestEmail) {
        logger.info('User has existing active reservation, checking if we can reuse session', {
          reservationId: existingReservation.id,
          sessionId: existingReservation.stripeSessionId,
          expiresAt: existingReservation.expiresAt,
        });

        // Try to retrieve the existing Stripe session
        if (existingReservation.stripeSessionId) {
          try {
            const existingSession = await stripe.checkout.sessions.retrieve(
              existingReservation.stripeSessionId,
            );

            // If session is still valid and unpaid, return it
            if (existingSession.status === 'open' && existingSession.payment_status === 'unpaid') {
              logger.info('Reusing existing valid session', { sessionId: existingSession.id });
              return NextResponse.json({
                url: existingSession.url,
              });
            } else {
              logger.info('Existing session is no longer valid', {
                status: existingSession.status,
                paymentStatus: existingSession.payment_status,
              });
              // Clean up the expired reservation
              await db
                .delete(SlotReservationsTable)
                .where(eq(SlotReservationsTable.id, existingReservation.id));
            }
          } catch (stripeError) {
            logger.info('Failed to retrieve existing session, will create new one', {
              error: stripeError,
            });
            // Clean up the invalid reservation
            await db
              .delete(SlotReservationsTable)
              .where(eq(SlotReservationsTable.id, existingReservation.id));
          }
        }
      } else {
        // Different user has this slot reserved
        logger.warn('Slot already reserved by another user', {
          requestingUser: meetingData.guestEmail,
          reservedBy: existingReservation.guestEmail,
          expiresAt: existingReservation.expiresAt,
        });
        return NextResponse.json(
          {
            error:
              'This time slot is temporarily reserved by another user. Please choose a different time or try again later.',
            code: 'SLOT_TEMPORARILY_RESERVED',
          },
          { status: 409 },
        );
      }
    }

    if (conflictingMeeting) {
      logger.error('Time slot already booked with confirmed payment', {
        eventId,
        startTime: appointmentStartTime,
        requestingUser: meetingData.guestEmail,
        existingBooking: {
          id: conflictingMeeting.id,
          email: conflictingMeeting.guestEmail,
        },
      });
      return NextResponse.json(
        {
          error: 'This time slot has been booked by another user. Please choose a different time.',
          code: 'SLOT_ALREADY_BOOKED',
        },
        { status: 409 },
      );
    }

    // Get or create customer with guest name for prefilled checkout
    logger.info('Attempting to get/create Stripe customer with name', {
      guestName: meetingData.guestName,
    });
    const customerId = await getOrCreateStripeCustomer(
      undefined,
      meetingData.guestEmail,
      meetingData.guestName, // Pass the guest name to prefill in checkout
    );
    logger.info('Customer retrieved/created', { customerId });

    // Calculate application fee
    const applicationFeeAmount = calculateApplicationFee(price);
    const expertAmount = price - applicationFeeAmount;
    logger.info('Calculated application fee', {
      originalPrice: price,
      feeAmount: applicationFeeAmount,
      expertAmount: expertAmount,
      feePercentage: STRIPE_CONFIG.PLATFORM_FEE_PERCENTAGE,
    });

    // Get the expert's country code for country-specific payout delay
    const expertCountry = event.user.country || DEFAULT_COUNTRY;
    const requiredPayoutDelay = getMinimumPayoutDelay(expertCountry);

    // Calculate transfer schedule
    const sessionStartTime = new Date(meetingData.startTime);
    // Add session duration (or default to 1 hour) + configured delay
    const sessionDurationMs = meetingData.duration
      ? meetingData.duration * 60 * 1000
      : 60 * 60 * 1000;

    // Calculate appointment end time (session start + duration)
    const appointmentEndTime = new Date(sessionStartTime.getTime() + sessionDurationMs);

    // Calculate how many days between payment (now) and session
    const currentDate = new Date();
    const paymentAgingDays = Math.max(
      0,
      Math.floor((sessionStartTime.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)),
    );

    // 🆕 CRITICAL FIX: Transfer must ALWAYS be at least 24h after appointment ends
    // This is a customer complaint window requirement (like Airbnb's first-night hold)
    // Separate from the 7-day payment aging requirement
    const minimumTransferDate = new Date(appointmentEndTime.getTime() + 24 * 60 * 60 * 1000);

    // Calculate earliest possible transfer date based on payment aging
    // For immediate payments (Credit Card), this is 7 days from now
    // For delayed payments (Multibanco), this is 7 days from when payment actually succeeds
    const paymentAgeBasedTransferDate = new Date(
      currentDate.getTime() + requiredPayoutDelay * 24 * 60 * 60 * 1000,
    );

    // Use the LATER of the two dates to ensure BOTH conditions are met:
    // 1. Payment must be aged enough (7 days from payment date)
    // 2. Appointment must have ended + 24h complaint window
    const transferDate = new Date(
      Math.max(minimumTransferDate.getTime(), paymentAgeBasedTransferDate.getTime()),
    );

    // Set to 4 AM on the scheduled day (matching CRON job time)
    transferDate.setHours(4, 0, 0, 0);

    logger.info('Scheduled transfer with dual-requirement compliance', {
      currentDate: currentDate.toISOString(),
      sessionStartTime: sessionStartTime.toISOString(),
      appointmentEndTime: appointmentEndTime.toISOString(),
      expertCountry,
      requiredPayoutDelay,
      paymentAgingDays,
      minimumTransferDate: minimumTransferDate.toISOString(),
      paymentAgeBasedTransferDate: paymentAgeBasedTransferDate.toISOString(),
      transferDate: transferDate.toISOString(),
      daysFromPayment: Math.floor(
        (transferDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000),
      ),
      hoursAfterAppointmentEnd: Math.floor(
        (transferDate.getTime() - appointmentEndTime.getTime()) / (60 * 60 * 1000),
      ),
    });

    // Calculate payment expiration and determine payment methods based on timing
    const meetingDate = new Date(meetingData.startTime);
    const currentTime = new Date();
    const hoursUntilMeeting = (meetingDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
    const daysUntilMeeting = hoursUntilMeeting / 24;

    // Determine payment methods and expiration based on timing
    let paymentMethodTypes: string[];
    let checkoutExpiresAt: Date; // Renamed for clarity - this is for Stripe Checkout Session

    /*
     * EXPIRATION LOGIC EXPLANATION:
     *
     * 1. Stripe Checkout Session: Must expire within 24 hours (Stripe's hard limit)
     * 2. Multibanco Payment Voucher: Has 7-day expiration (handled automatically by Stripe)
     * 3. Slot Reservation: Created by webhook, expires in 7 days (our business logic)
     *
     * The checkout session expiration is different from payment completion deadlines!
     */

    if (daysUntilMeeting <= 8) {
      // Meeting is ≤ 8 days away - Only allow Card payments
      paymentMethodTypes = ['card'];

      // Standard checkout session expiration (1 hour)
      checkoutExpiresAt = new Date(currentTime.getTime() + 60 * 60 * 1000);

      logger.info(
        logger.fmt`Immediate booking: Meeting in ${daysUntilMeeting.toFixed(1)} days - Card only, expires in 1 hour`,
      );
    } else {
      // Meeting is > 8 days away - Allow both Card and Multibanco
      paymentMethodTypes = ['card', 'multibanco'];

      // Checkout session expires in 24 hours (Stripe's maximum)
      // Note: Multibanco voucher will have 7-day expiration automatically from Stripe
      checkoutExpiresAt = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);

      logger.info(
        logger.fmt`Advance booking: Meeting in ${daysUntilMeeting.toFixed(1)} days - Card + Multibanco, checkout expires in 24h`,
      );
    }

    // Calculate fees
    const platformFee = applicationFeeAmount;
    const scheduledTransferTime = transferDate;

    // Create metadata object once to avoid duplication
    const sharedMetadata = createSharedMetadata({
      eventId,
      expertWorkosUserId: event.workosUserId,
      guestEmail: meetingData.guestEmail,
      guestName: meetingData.guestName,
      startTime: meetingData.startTime,
      duration: event.durationInMinutes,
      guestNotes: meetingData.guestNotes,
      price,
      platformFee,
      expertAmount,
      expertStripeAccountId,
      expertCountry,
      paymentAgingDays,
      requiredPayoutDelay,
      scheduledTransferTime,
      appointmentEndTime,
      requiresApproval,
      meetingData,
    });

    // Create the checkout session with conditional payment methods
    const session = await stripe.checkout.sessions.create({
      payment_method_types:
        paymentMethodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${event.name} with ${meetingMetadata.expertName}`,
              description: `${meetingMetadata.duration} minute session on ${new Date(
                meetingMetadata.start,
              ).toLocaleString(meetingMetadata.loc, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
              })}`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/${locale}/${username}/${eventSlug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale}/${username}/${eventSlug}`,
      customer: customerId,
      customer_creation: customerId ? undefined : 'always',
      expires_at: Math.floor(checkoutExpiresAt.getTime() / 1000),
      allow_promotion_codes: true,
      // Enhanced tax handling
      automatic_tax: {
        enabled: true,
        liability: { type: 'account', account: expertStripeAccountId },
      },
      tax_id_collection: {
        enabled: true,
        required: 'if_supported',
      },
      // Billing address collection for tax calculation
      billing_address_collection: 'required',
      consent_collection: {
        terms_of_service: 'required',
      },
      // Add notice about Multibanco availability based on appointment timing
      ...(daysUntilMeeting > 8 &&
        paymentMethodTypes.includes('multibanco') && {
          custom_text: {
            submit: {
              message: t('multibancoNotice', { paymentPoliciesUrl }),
            },
            terms_of_service_acceptance: {
              message: t('termsOfService', { termsUrl, paymentPoliciesUrl }),
            },
          },
        }),
      // For appointments within 8 days (no Multibanco), still show terms
      ...(daysUntilMeeting <= 8 && {
        custom_text: {
          terms_of_service_acceptance: {
            message: t('termsOfService', { termsUrl, paymentPoliciesUrl }),
          },
        },
      }),
      // Enhanced customer information collection
      locale: (() => {
        const userLocale = meetingData.locale || 'en';
        // Map our locales to valid Stripe locales
        const localeMap: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = {
          en: 'en',
          'pt-BR': 'pt-BR',
          es: 'es',
          fr: 'fr',
          de: 'de',
          it: 'it',
          pt: 'pt-BR', // Map pt to pt-BR for Stripe
        };
        return localeMap[userLocale] || 'en';
      })(),
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      submit_type: 'book',
      // Prefill customer information only if we don't have an existing customer
      ...(!customerId &&
        meetingData.guestName && {
          customer_email: meetingData.guestEmail,
          customer_name: meetingData.guestName,
        }),
      // ADD METADATA TO CHECKOUT SESSION (for webhook processing)
      metadata: sharedMetadata,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: expertStripeAccountId,
        },
        metadata: {
          ...sharedMetadata,
          session_id: '', // Will be updated after session creation
        },
      },
    });

    logger.info('Checkout session created successfully', {
      sessionId: session.id,
      url: session.url,
    });

    // **IMPORTANT: Update payment intent with session ID for webhook linking**
    if (session.payment_intent) {
      try {
        await stripe.paymentIntents.update(session.payment_intent.toString(), {
          metadata: {
            session_id: session.id,
          },
        });
        logger.info('Payment intent updated with session ID', {
          paymentIntentId: session.payment_intent,
          sessionId: session.id,
        });
      } catch (updateError) {
        Sentry.captureException(updateError);
        logger.error('Failed to update payment intent with session ID', { error: updateError });
        // Continue execution - this is not critical for the immediate flow
      }
    }

    logger.info('Checkout session created successfully - no slot reservation needed');
    logger.info('Slot management will be handled by webhooks based on payment method');

    // Non-blocking cache operations after response is sent
    after(async () => {
      if (idempotencyKey && session.url) {
        await IdempotencyCache.set(idempotencyKey, { url: session.url });
        logger.info(logger.fmt`Cached result for idempotency key: ${idempotencyKey}`);
      }

      if (meetingData?.guestEmail && meetingData?.startTime) {
        const formCacheKey = FormCache.generateKey(
          eventId,
          meetingData.guestEmail,
          meetingData.startTime,
        );
        await FormCache.markCompleted(formCacheKey);
        logger.info(logger.fmt`Marked form submission as completed in FormCache: ${formCacheKey}`);
      }
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Request processing failed', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : 'Unknown error',
      stripeError:
        error instanceof Stripe.errors.StripeError
          ? {
              type: error.type,
              code: error.code,
              decline_code: error.decline_code,
              param: error.param,
            }
          : undefined,
    });

    // **FORM CACHE: Mark submission as failed**
    if (eventId && meetingData?.guestEmail && meetingData?.startTime) {
      try {
        const formCacheKey = FormCache.generateKey(
          eventId,
          meetingData.guestEmail,
          meetingData.startTime,
        );
        await FormCache.markFailed(formCacheKey);
        logger.info(logger.fmt`Marked form submission as failed in FormCache: ${formCacheKey}`);
      } catch (cacheError) {
        Sentry.captureException(cacheError);
        logger.error('Failed to mark FormCache as failed', { error: cacheError });
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Stripe.errors.StripeError ? error.code : 'unknown',
      },
      { status: 500 },
    );
  }
}
