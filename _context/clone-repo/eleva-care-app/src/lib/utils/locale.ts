import { logger } from '@/lib/utils/logger';
import type Stripe from 'stripe';

/**
 * Extract locale from payment intent metadata and fallback sources
 *
 * Checks for locale in the following order:
 * 1. Meeting metadata JSON (paymentIntent.metadata.meeting.locale)
 * 2. Direct metadata (paymentIntent.metadata.locale)
 * 3. Default fallback ('en')
 *
 * @param paymentIntent - Stripe PaymentIntent object
 * @returns Locale string (e.g., 'en', 'pt', 'es')
 *
 * @example
 * ```typescript
 * const paymentIntent = await stripe.paymentIntents.retrieve(id);
 * const locale = extractLocaleFromPaymentIntent(paymentIntent);
 * // Use locale for internationalized notifications
 * ```
 */
export function extractLocaleFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): string {
  try {
    // First, try to get locale from meeting metadata
    if (paymentIntent.metadata?.meeting) {
      const meetingData = JSON.parse(paymentIntent.metadata.meeting);
      if (meetingData.locale && typeof meetingData.locale === 'string') {
        logger.info('Using locale from payment intent meeting metadata', {
          paymentIntentId: paymentIntent.id,
          locale: meetingData.locale,
          source: 'meeting_metadata',
        });
        return meetingData.locale;
      }
    }

    // Fallback: Check if there's a locale in the payment intent metadata directly
    if (paymentIntent.metadata?.locale) {
      logger.info('Using locale from payment intent direct metadata', {
        paymentIntentId: paymentIntent.id,
        locale: paymentIntent.metadata.locale,
        source: 'direct_metadata',
      });
      return paymentIntent.metadata.locale;
    }

    // Final fallback
    logger.info('No locale found in payment intent metadata, using default', {
      paymentIntentId: paymentIntent.id,
      locale: 'en',
      source: 'default_fallback',
    });
    return 'en';
  } catch (error) {
    logger.error('Error extracting locale from payment intent metadata', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'en';
  }
}

